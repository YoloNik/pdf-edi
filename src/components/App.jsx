import React, { useState, useEffect } from 'react';
import { Button, Table, message, Spin } from 'antd';
import { pdfjs } from 'react-pdf';
import { parse, subDays, format, isWeekend} from 'date-fns';
import moment from 'moment';
import { da } from 'date-fns/locale';

const App = () => {
  const [pdfFileKey, setPdfFileKey] = useState(0);
  const [dataToRender, setDataToRender] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

  const onFileChange = (e) => {
    const file = e.target.files[0];

    const success = () => {
      messageApi.open({
        type: 'success',
        content: "Successfully uploaded! Don't forget to check the data before adding it to the NScap",
        duration: 7,
      });
    };
      setPdfFileKey((prevKey) => prevKey + 1);
      fetchData(file);

    if (file) {
      success()
    } else {
      message.error('Failed to upload the file.');
    }
  };

  const fetchData = async (file) => {
    try {
      setLoading(true);
      const extractedData = await extractTextFromPdf(file);
      setDataToRender(extractedData);
    } catch (error) {
      console.error('Error when extracting data from PDF.', error);
    } finally {
      setLoading(false);
    }
  };

  const clearTable = () => {
    setDataToRender([]);
  };

  const extractTextFromPdf = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    let extractedData;
    let allText = '';


    try {
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const maxPages = pdf.numPages;

      for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map((item) => item.str);
        allText += textItems.join('\n') + '\n';
      }

      const clientData = cleanText(allText);
      const enhancedData = clientData.map(item => ({ ...item, transitTime: item.transitTime || 0 }));

  setDataToRender(enhancedData);
      console.log(enhancedData)

      extractedData = clientData;
      setDataToRender(extractedData);
    } catch (error) {
      throw error;
    }

    return extractedData;
  };


  const calculateShippingDate = (deliveryDateStr, transitTime) => {
    if (!deliveryDateStr || transitTime === '' || isNaN(transitTime) || parseInt(transitTime) < 0) {
      return null;
    }
  
    const deliveryDate = parse(deliveryDateStr, 'dd/MM/yyyy', new Date());
  
    if (isNaN(deliveryDate)) {
      return null;
    }
  
    let shippingDate = deliveryDate;
    let daysToSubtract = parseInt(transitTime);
  
    while (daysToSubtract > 0) {
      shippingDate = subDays(shippingDate, 1);
      if (!isWeekend(shippingDate)) {
        daysToSubtract--;
      }
    }
  
    return format(shippingDate, 'dd/MM/yyyy');
  };

  const cleanText = (text) => {
    const filteredText = text.replace(/[^\w\s!@#$%^&*()_+-={}:;'",.<>?/\\|`~]/g, '');
    const lines = filteredText.split('\n').filter((item) => item.trim() !== '');
    const cleanedData = [];

    let currentItem = { PartNumber: '', id: '', quantities: {} };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('Part Number:')) {
        if (currentItem.PartNumber !== '') {
          cleanedData.push({ ...currentItem, id: `item_${cleanedData.length + 1}` });
          currentItem = { PartNumber: '', id: '', quantities: {} };
        }

        const partNumberLine = lines[i + 1];
        const partNumberMatch = partNumberLine.match(/(\d+)/);

        if (partNumberMatch) {
          const partNumber = partNumberMatch[1];
          currentItem.PartNumber = partNumber;
          i++;
        }
      } else {
        const dataMatch = line.match(/\b(\d{2}\/\d{2}\/\d{2})\b/);
        if (dataMatch) {
          const date = dataMatch[1];
          const nextLine = lines[i + 7];
          const value = parseFloat(nextLine.trim().replace(/\./g,"")) || 0;
          currentItem.quantities[date] = value;
        }
      }
    }

    if (currentItem.PartNumber !== '') {
      cleanedData.push({ ...currentItem, id: `item_${cleanedData.length + 1}` });
    }

    // Сортировка по дате
    cleanedData.sort((a, b) => {
      const dateA = parse(Object.keys(a.quantities)[0], 'dd/MM/yyyy', new Date());
      const dateB = parse(Object.keys(b.quantities)[0], 'dd/MM/yyyy', new Date());
      return dateA - dateB;
    });

    return cleanedData;
  };

  const handleInputChange = (id, transitTime) => {
    setDataToRender((prevData) => {
      const updatedData = prevData.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item };
          updatedItem.transitTime = parseInt(transitTime, 10) || '';
          const updatedQuantities = {};
      
          Object.keys(updatedItem.quantities).forEach((dateStr) => {
            const newDateStr = calculateShippingDate(dateStr, updatedItem.transitTime);
            if (newDateStr) {
              updatedQuantities[newDateStr] = updatedItem.quantities[dateStr];
            }
          });
      
          updatedItem.quantities = updatedQuantities;
          return updatedItem;
        }
        return item;
      });
  
      return updatedData;
    });
  };

  const generateColumnsForPart = (quantities) => {
    const dates = Object.keys(quantities);
    const columns = [
      {
        title: 'Transit Time',
        dataIndex: 'transitTime',
        key: 'transitTime',
        render: (text, record) => (
          <input
            type="text"
            defaultValue={record.transitTime}
            onChange={(e) => handleInputChange(record.key, e.target.value)}
            style={{ width: '60px' }}
          />
        ),
      },
      { title: 'Part Number', dataIndex: 'PartNumber', key: 'PartNumber' },
      ...dates.map((date) => ({
        title: moment(date, 'DD/MM/YYYY').format('DD/MM/YYYY'),
        dataIndex: date, // Убран префикс quantities_
        key: date,
        render: (text) => text || 0,
        className: moment(date, 'DD/MM/YYYY').isoWeekday() > 5 ? 'weekend-column' : '',
      })),
    ];
  
    return columns;
  };

  const generateDataSourceForPart = (partData) => {
    // Создаем один объект данных для одной строки таблицы
    const rowData = {
      key: partData.id,
      PartNumber: partData.PartNumber,
      transitTime: partData.transitTime,
      ...partData.quantities, // Используем quantities напрямую, без префикса
    };
  
    return [rowData]; // Источник данных - это массив с одним объектом
  };
  

    // const columns = generateColumnsForPart();
  // const dataSource = generateDataSourceForPart();

  useEffect(() => {
    // Вызываем функцию handleInputChange, чтобы обновить данные при изменении времени транзита
    if (dataToRender.length >0) {

    }
  }, [dataToRender]);

  return (
    <div>
      {contextHolder}
      <div className='info'>
        <p style={{ margin: 0 }}>Created with love by Mykyta Slipachuk</p>
      </div>
      <div style={{ padding: '0 20px' }}>
        <h1 style={{ marginBottom: '20px' }}>PDF EDI Extractor</h1>
        <div key={pdfFileKey}>
          <div className='input-container'>
            <label className="custom-file-upload">
              Select a file
              <input type="file" onChange={onFileChange} accept=".pdf" />
            </label>
            <Button type="primary" onClick={clearTable}>
              Clear table
            </Button>
          </div>
        </div>
      </div>
  
      {pdfFileKey > 0 && (
        <div style={{ marginTop: '20px' }}>
          {loading ? (
            <Spin size="large" style={{ position: 'fixed', top: '50%', left: '50%', zIndex: 1001 }} />
          ) : (
            dataToRender.length > 0 ? (
              dataToRender.map((partData, index) => (
                <div key={`part-table-${index}`}>
                  {/* <h2>{`Part Number: ${partData.PartNumber}`}</h2> */}
                  <Table
                    dataSource={generateDataSourceForPart(partData)}
                    columns={generateColumnsForPart(partData.quantities)}
                    pagination={false}
                  />
                </div>
              ))
            ) : <p style={{ marginTop: '20px' }}>Data not found</p>
          )}
        </div>
      )}
    </div>
  );
};

export default App; 