export default async function handler(req, res) {
  // Enable CORS for your frontend domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sheetName = 'Prices' } = req.query;
    
    // Get environment variables
    const sheetId = process.env.SHEET_ID;
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!sheetId || !apiKey) {
      console.error('Missing environment variables:', { 
        hasSheetId: !!sheetId, 
        hasApiKey: !!apiKey 
      });
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Construct the Google Sheets API URL
    const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?`;
    const query = encodeURIComponent(''); // Empty query to select all data
    const url = `${base}&sheet=${encodeURIComponent(sheetName)}&tq=${query}&key=${apiKey}`;

    // Fetch data from Google Sheets
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.status}`);
    }

    const text = await response.text();
    
    // Parse the response (Google Sheets returns JSON wrapped in a specific format)
    const jsonData = JSON.parse(text.substr(47).slice(0, -2));
    
    // Process the data
    const columns = [];
    jsonData.table.cols.forEach(heading => {
      if (heading.label) {
        columns.push(heading.label.toLowerCase().replace(/\s/g, ''));
      }
    });

    const data = [];
    jsonData.table.rows.forEach(row => {
      const rowData = {};
      columns.forEach((colName, index) => {
        rowData[colName] = (row.c[index] != null) ? row.c[index].v : '';
      });
      data.push(rowData);
    });

    res.status(200).json({ 
      success: true, 
      data, 
      columns,
      sheetName 
    });

  } catch (error) {
    console.error('Error fetching sheet data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch data from Google Sheets',
      details: error.message 
    });
  }
} 