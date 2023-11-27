import React, { useState, useEffect } from 'react';
import { Button, Table } from 'antd';
import { pdfjs } from 'react-pdf';

const App = () => {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfData, setPdfData] = useState([]);
  const [dataToRender, setDataToRender] = useState([]);


  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

  const onFileChange = (e) => {
    const file = e.target.files[0];
    setPdfFile(file);
  };

  const extractDataByWeeks = (text) => {
    const filteredText = text.replace(/[^\w\s!@#$%^&*()_+-={}:;'",.<>?/\\|`~]/g, '');
    const lines = filteredText.split('\n').filter((item) => item.trim() !== "");
    const dataByWeeks = {};
  
    let currentWeek = null;
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
  
      if (line.startsWith('W')) {
        const weekNumberMatch = line.match(/W(\d+)/);
        if (weekNumberMatch) {
          currentWeek = `W${weekNumberMatch[1]}`;
          dataByWeeks[currentWeek] = [];
        }
      } else if (currentWeek) {
        const dateMatch = line.match(/\b(\d{2}\/\d{2}\/\d{2})\b/);
        if (dateMatch) {
          const date = dateMatch[1];
          const nextLine = lines[i + 7];
          dataByWeeks[currentWeek].push({ [date]: nextLine.trim() });
        }
      }
    }
    console.log(dataByWeeks)
  
    return dataByWeeks;
  };

  const cleanText = (text) => {
    const filteredText = text.replace(/[^\w\s!@#$%^&*()_+-={}:;'",.<>?/\\|`~]/g, '');
    const lines = filteredText.split('\n').filter((item) => item.trim() !== "");
    const cleanedData = [];
  
    let currentItem = { PartNumber: '', id: '', quantities: [] };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // console.log(line)


      if (line.startsWith('Part Number:')) {
        if (currentItem.PartNumber !== '') {
          const quantities =  extractDataByWeeks(text)
          cleanedData.push({ ...currentItem, id: `item_${cleanedData.length + 1}`, quantities });
          
        }
        currentItem = { PartNumber: '', id: '', quantities: [] };
  
        const partNumberLine = lines[i + 1];
  
        const partNumberMatch = partNumberLine.match(/(\d+)/);
  
        if (partNumberMatch) {
          const partNumber = partNumberMatch[1];
          currentItem.PartNumber = partNumber;
          i++;
        }
      }
    }
  
    if (currentItem.PartNumber !== '') {
      cleanedData.push({ ...currentItem, id: `item_${cleanedData.length + 1}` });
    }
  
    return cleanedData;
  };  

  const extractTextFromPdf = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    let extractedData;
    let allText = "";
  
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
      
      
      extractedData=clientData
      setDataToRender(extractedData)
      console.log(dataToRender)
    } catch (error) {
      throw error;
    }
    
    return extractedData;
  };

  const fetchData = async () => {
    if (pdfFile) {
      try {
        const extractedData = await extractTextFromPdf(pdfFile);
        setDataToRender(extractedData);
      } catch (error) {
        console.error('Ошибка при извлечении данных из PDF', error);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [pdfFile]);

  const columns = [
    { title: 'Part Number', dataIndex: 'PartNumber', key: 'PartNumber' },
  ];

  return (
    <div className="App">
      <h1>PDF Data Extractor</h1>
      <input type="file" onChange={onFileChange} accept=".pdf" />
      {pdfFile && (
        <div>
          <p>Выбранный файл: {pdfFile.name}</p>
          <Button type="primary" onClick={fetchData}>
            Извлечь данные из PDF
          </Button>

          {dataToRender.length > 0 ? (
            <Table 
            dataSource={dataToRender} 
            columns={columns} rowKey="id" 
            pagination={{ pageSize: 4 }}/>
            
            ) : (
              <p>Данные не найдены</p>
              )}
        </div>
      )}
    </div>
  );
};

export default App;
