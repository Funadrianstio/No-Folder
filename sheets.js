// API endpoint for the serverless function
// This will work when deployed to Vercel
const API_BASE_URL = '/api/sheets';

// Fallback for local development (temporary)
const FALLBACK_SHEET_ID = '1NpL7Ip_oaj8FEi_zTTl-7t9hdWSGWrtHyfRYUvLyons';
const FALLBACK_BASE = `https://docs.google.com/spreadsheets/d/${FALLBACK_SHEET_ID}/gviz/tq?`;

const data = [];

let rightEyeData = [];
let leftEyeData = [];
let rebate = [];

const selections = {
  newEst: null,
  selfPay: null,
  fittingType: null,
  newToBrand: null
};

// Authentication state
let isAuthenticated = false;
let userEmail = null;

// Handle Google Sign-In response
function handleCredentialResponse(response) {
    console.log('Received Google Sign-In response');
    
    // Decode the credential response
    const responsePayload = jwt_decode(response.credential);
    console.log('Decoded response:', responsePayload);
    
    // Store user email
    userEmail = responsePayload.email;
    console.log('User email:', userEmail);
    
    // Check if the email is authorized
    const authorizedEmails = [
        // Add your email here - replace with your actual Google email
        'adrianvelascood@gmail.com'  // Your correct email address
    ];
    
    console.log('Checking authorization for:', userEmail);
    console.log('Authorized emails:', authorizedEmails);
    
    if (authorizedEmails.includes(userEmail)) {
        console.log('User authorized');
        isAuthenticated = true;
        // Hide login overlay and show main content
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('main-content').classList.remove('d-none');
        // Initialize the application
        init();
    } else {
        console.log('User not authorized');
        alert('Sorry, you are not authorized to access this application. Please contact the administrator.');
        // Sign out the user
        google.accounts.id.disableAutoSelect();
    }
}

document.addEventListener('DOMContentLoaded', init);

// Updated function to fetch data from serverless function with fallback
async function fetchSheetData(sheetName = 'Prices') {
  try {
    // First, try the secure serverless function
    console.log('Attempting to fetch from serverless function...');
    const response = await fetch(`${API_BASE_URL}?sheetName=${encodeURIComponent(sheetName)}`);
    
    if (response.ok) {
      const result = await response.json();
      
      if (result.success) {
        console.log('Successfully fetched from serverless function');
        return result.data;
      }
    }
    
    // If serverless function fails, fall back to direct Google Sheets call (for local development)
    console.log('Serverless function failed, falling back to direct Google Sheets call...');
    console.warn('⚠️ WARNING: Using fallback method - this exposes your sheet ID. Deploy to Vercel for security.');
    
    const query = encodeURIComponent(''); // Empty query to select all data
    const url = `${FALLBACK_BASE}&sheet=${encodeURIComponent(sheetName)}&tq=${query}`;
    
    const fallbackResponse = await fetch(url);
    
    if (!fallbackResponse.ok) {
      throw new Error(`HTTP error! status: ${fallbackResponse.status}`);
    }
    
    const text = await fallbackResponse.text();
    const jsData = JSON.parse(text.substr(47).slice(0, -2));
    
    // Process the data
    const columns = [];
    jsData.table.cols.forEach(heading => {
      if (heading.label) {
        columns.push(heading.label.toLowerCase().replace(/\s/g, ''));
      }
    });

    const data = [];
    jsData.table.rows.forEach(row => {
      const rowData = {};
      columns.forEach((colName, index) => {
        rowData[colName] = (row.c[index] != null) ? row.c[index].v : '';
      });
      data.push(rowData);
    });
    
    console.log('Successfully fetched from fallback method');
    return data;
    
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
}

function init() {
  if (!isAuthenticated) {
    console.log('User not authenticated');
    return;
  }

  // Fetch main pricing data
  fetchSheetData('Prices')
    .then(sheetData => {
      // Clear existing data
      data.length = 0;
      data.push(...sheetData);
      
      console.log('Raw column names:', Object.keys(data[0] || {}));
      console.log('First 3 rows of data:', data.slice(0, 3));
      
      // Debug all unique manufacturer values
      const manufacturers = [...new Set(data.map(item => item.manufacturer).filter(Boolean))];
      console.log('All unique manufacturers:', manufacturers);
      console.log('Manufacturer values with their counts:', 
        manufacturers.map(m => ({
          manufacturer: m,
          count: data.filter(item => item.manufacturer === m).length
        }))
      );

      setupInputs?.(); // Only call if defined
      enableButtons();

      // Auto-populate manufacturer/brand dropdowns
      if (manufacturers.length) {
        const defaultManufacturer = manufacturers[0];
        const brands = [...new Set(data.filter(item => item.manufacturer === defaultManufacturer).map(item => item.brand).filter(Boolean))];
        populateDropdown('right-eye-dropdown', brands, defaultManufacturer, 'right');
        populateDropdown('left-eye-dropdown', brands, defaultManufacturer, 'left');
      }

      // ✅ Load fitting fees here
      loadFittingFees();
    })
    .catch(error => {
      console.error('Error:', error);
      if (error.message === 'Authentication required') {
        // Show login overlay if authentication is lost
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('main-content').classList.add('d-none');
      } else {
        // Show user-friendly error message
        alert('Failed to load pricing data. Please try refreshing the page or contact support if the problem persists.');
      }
    });
}

// Updated fitting fees loading function
const fittingFeesData = [];

//Loading fitting fee data
async function loadFittingFees() {
  try {
    const fittingFeesSheetData = await fetchSheetData('Fitting Fees');
    
    // Clear existing data
    fittingFeesData.length = 0;
    fittingFeesData.push(...fittingFeesSheetData);

    console.log("Fitting Fees Loaded:", fittingFeesData);
  } catch (error) {
    console.error('Error loading fitting fees:', error);
  }
}

function enableButtons() {
  const manufacturerButtons = document.querySelectorAll('.manufacturer-btn');

  // Log initial state with more detail
  console.log('Initial data state:', {
    totalRows: data.length,
    manufacturers: [...new Set(data.map(item => item.manufacturer).filter(Boolean))],
    acuvueData: data.filter(item => {
      console.log('Initial Acuvue check:', {
        manufacturer: item.manufacturer,
        type: typeof item.manufacturer,
        length: item.manufacturer?.length,
        exactMatch: item.manufacturer === 'Acuvue',
        trimmedMatch: item.manufacturer?.trim() === 'Acuvue',
        lowerCaseMatch: item.manufacturer?.toLowerCase() === 'acuvue'
      });
      return item.manufacturer === 'Acuvue';
    })
  });

  manufacturerButtons.forEach(button => {
    button.addEventListener('click', () => {
      const selectedEye = button.dataset.eye;
      const selectedManufacturer = button.dataset.manufacturer;
      
      // Log state when button is clicked with more detail
      console.log('Button clicked state:', {
        selectedManufacturer,
        selectedManufacturerType: typeof selectedManufacturer,
        selectedManufacturerLength: selectedManufacturer?.length,
        totalRows: data.length,
        manufacturers: [...new Set(data.map(item => {
          console.log('Manufacturer in data:', {
            value: item.manufacturer,
            type: typeof item.manufacturer,
            length: item.manufacturer?.length
          });
          return item.manufacturer;
        }).filter(Boolean))],
        acuvueData: data.filter(item => {
          const matches = item.manufacturer === selectedManufacturer;
          console.log('Comparing manufacturers:', {
            dataManufacturer: item.manufacturer,
            selectedManufacturer,
            matches,
            dataType: typeof item.manufacturer,
            selectedType: typeof selectedManufacturer
          });
          return matches;
        })
      });

      // Remove 'selected' from all buttons for the same eye
      manufacturerButtons.forEach(btn => {
        if (btn.dataset.eye === selectedEye) {
          btn.classList.remove('selected');
        }
      });

      // Add 'selected' class to the clicked button
      button.classList.add('selected');

      // Filter and populate dropdown with more lenient comparison
      const filtered = data.filter(item => {
        const dataManufacturer = String(item.manufacturer || '').trim();
        const compareManufacturer = String(selectedManufacturer || '').trim();
        const matches = dataManufacturer === compareManufacturer;
        
        console.log('Filtering comparison:', {
          dataManufacturer,
          compareManufacturer,
          matches,
          dataType: typeof dataManufacturer,
          compareType: typeof compareManufacturer
        });
        
        return matches;
      });
      
      console.log('Filtered data for', selectedManufacturer, ':', filtered);
      const uniqueBrands = [...new Set(filtered.map(item => item.brand))].filter(Boolean);
      console.log('Unique brands for', selectedManufacturer, ':', uniqueBrands);

      if (selectedEye === 'right') {
        populateDropdown('right-eye-dropdown', uniqueBrands, selectedManufacturer, 'right');
      } else {
        populateDropdown('left-eye-dropdown', uniqueBrands, selectedManufacturer, 'left');
      }
    });
  });
}

function populateDropdown(containerId, uniqueBrands, selectedManufacturer, eye) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';  // Clear any existing dropdown

  const select = document.createElement('select');
  select.innerHTML = `<option value="">Select a brand</option>`;

  uniqueBrands.forEach(brand => {
    const option = document.createElement('option');
    option.value = brand;
    option.textContent = brand;
    select.appendChild(option);
  });

  container.appendChild(select);  // Append the dropdown to the container

  // Add event listener for when a brand is selected
  select.addEventListener('change', () => {
    const selectedBrand = select.value;
    console.log(`Selected Brand for ${eye} Eye: ${selectedBrand}`);

    const brandData = data.find(item =>
      item.brand === selectedBrand && item.manufacturer === selectedManufacturer
    );

    if (brandData) {
      if (eye === 'right') {
        rightEyeData = brandData;
        const price1 = parseFloat(rightEyeData.priceperbox);
        document.getElementById('price1').textContent = isNaN(price1) ? "$0.00" : `$${price1.toFixed(2)}`;
        document.getElementById('brand1').textContent = rightEyeData.brand ? `(${rightEyeData.brand})` : "(Not selected)";
        updateBoxesDisplay();
        // Immediately update rebate and supply text on first selection
        const normalizedValue = selections.newToBrand?.toLowerCase() === 'yes' ? 'Yes' : 'No';
        updateRebateDisplay(rightEyeData, normalizedValue);
      } else {
        leftEyeData = brandData;
        const price2 = parseFloat(leftEyeData.priceperbox);
        document.getElementById('price2').textContent = isNaN(price2) ? "$0.00" : `$${price2.toFixed(2)}`;
        document.getElementById('brand2').textContent = leftEyeData.brand ? `(${leftEyeData.brand})` : "(Not selected)";
        updateBoxesDisplay();
      }
    }
  });
}

// Only ONE event handler for toggle buttons!
document.querySelectorAll('.btn-group[data-group]').forEach(group => {
  const groupKey = group.dataset.group; // e.g., 'new-est'
  
  // Initialize the group - no selection by default
  group.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.remove('selected');
  });

  group.querySelectorAll('.toggle-btn').forEach(button => {
    button.addEventListener('click', () => {
      const value = button.dataset.value;
      const camelCaseKey = groupKey.replace(/-([a-z])/g, g => g[1].toUpperCase());

      // Deselect all buttons in this group only
      group.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('selected');
      });
      
      // Select this button
      button.classList.add('selected');
      
      // Save selected value
      selections[camelCaseKey] = value;

      console.log(`${camelCaseKey} selected: ${selections[camelCaseKey]}`);

      // Call rebate update if it's the newToBrand toggle group
      if (camelCaseKey === 'newToBrand') {
        const normalizedValue = selections.newToBrand?.toLowerCase() === 'yes' ? 'Yes' : 'No';

        if (rightEyeData && Object.keys(rightEyeData).length > 0) {
          updateRebateDisplay(rightEyeData, normalizedValue);
        }
      }

      // Run fitting fee logic automatically
      determineFittingFee(selections, fittingFeesData);
    });
  });
});

function setupInputs() {
  const additionalFees = parseFloat(document.getElementById('additional-fees').value) || 0;
  const contactlensAllowance = parseFloat(document.getElementById('contact-lens-allowance').value) || 0;
  const irTraining = parseFloat(document.getElementById('ir-training').value) || 0;
  const additionalSavings = parseFloat(document.getElementById('additional-savings').value) || 0;

  // Determine which fitting fee button is selected
  let fittingCopay = 0, fittingDiscountPercent = 0, fittingDiscountAmount = 0;
  if (document.getElementById('fitting-copay-btn').classList.contains('selected')) {
    fittingCopay = parseFloat(document.getElementById('fitting-copay-input').value) || 0;
  } else if (document.getElementById('fitting-percent-btn').classList.contains('selected')) {
    fittingDiscountPercent = parseFloat(document.getElementById('fitting-percent-input').value) || 0;
  } else if (document.getElementById('fitting-dollar-btn').classList.contains('selected')) {
    fittingDiscountAmount = parseFloat(document.getElementById('fitting-dollar-input').value) || 0;
  }

  // Save or use the values as needed here
  console.log({ additionalFees, fittingCopay, contactlensAllowance, fittingDiscountAmount, fittingDiscountPercent });
}

function updateExamDetailsTable() {
  // Sum the displayed values in the Exam Details section
  function getDisplayValue(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    return parseFloat(el.textContent.replace(/[^0-9.-]+/g, '')) || 0;
  }
  const examCopay = getDisplayValue('examCopay');
  const clExam = getDisplayValue('clExam');
  const retinalImage = getDisplayValue('retinalImage');
  const irTraining = getDisplayValue('irTraining');
  const additionalFees = getDisplayValue('additionalFeesDisplay');
  const examSubtotal = examCopay + clExam + retinalImage + irTraining + additionalFees;

  document.getElementById("examDetailsSubtotal").textContent = `$${examSubtotal.toFixed(2)}`;
  document.getElementById("oopExam").textContent = `$${examSubtotal.toFixed(2)}`;

  // (Keep updating the individual fields as before)
  // ... existing code ...
}

// Update Deductions Subtotal
function updateDeductionsSubtotal() {
  const contactLensAllowance = parseFloat(document.getElementById('contactLensAllowanceDisplay').textContent.replace(/[^0-9.-]+/g, '')) || 0;
  const additionalSavings = parseFloat(document.getElementById('additionalSavingsDisplay').textContent.replace(/[^0-9.-]+/g, '')) || 0;
  
  // Both values are already negative, so just sum them
  const deductionsSubtotal = contactLensAllowance + additionalSavings;
  
  // Always display as negative, even if user enters positive numbers
  document.getElementById('deductionsSubtotal').textContent = `-$${Math.abs(deductionsSubtotal).toFixed(2)}`;
}

// Update deductions subtotal whenever relevant fields change
['contactLensAllowanceDisplay', 'additionalSavingsDisplay'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('DOMSubtreeModified', updateDeductionsSubtotal);
  }
});
// Also call once on page load
updateDeductionsSubtotal();

// 🔁 Auto-update whenever related fields change
const examInputs = [
  "exam-copay",
  "retinal-price",
  "ir-training",
  "fitting-copay",
  "fitting-discount-amount",
  "fitting-discount-percent",
  "additional-fees",
];

examInputs.forEach(id => {
  const input = document.getElementById(id);
  if (input) {
    input.addEventListener("input", updateExamDetailsTable);
  }
});

//Exam Detail Table Data Insertion

function setupCurrencyInputListener(inputId, displayId, makeNegative = false) {
  const inputEl = document.getElementById(inputId);
  const displayEl = document.getElementById(displayId);

  if (!inputEl || !displayEl) {
    console.warn(`Elements not found: ${inputId}, ${displayId}`);
    return;
  }

  inputEl.addEventListener('input', () => {
    let value = parseFloat(inputEl.value);
    
    if (makeNegative && !isNaN(value)) value = -Math.abs(value);
    
    // Set the display first
    displayEl.textContent = isNaN(value) ? '---' : `$${value.toFixed(2)}`;
    
    // Then update deductions subtotal (now it will read the correct new value)
    if (inputId === 'contact-lens-allowance' || inputId === 'additional-savings') {
      updateDeductionsSubtotal();
    }
    
    updateExamDetailsTable();
    updateFinalOOP();
  });
}

// Add DOMSubtreeModified listeners for all exam display values
['examCopay', 'clExam', 'retinalImage', 'irTraining', 'additionalFeesDisplay'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('DOMSubtreeModified', updateExamDetailsTable);
  }
});

// Remove or comment out the duplicate oopExam calculation in updateOOPExamTotal
function updateOOPExamTotal() {
  // let total = 0;
  // const clExamText = document.getElementById('clExam')?.textContent || '';
  // const clExamValue = parseFloat(clExamText.replace('$', '')) || 0;
  // total += clExamValue;
  // ids.forEach(id => {
  //   const input = document.getElementById(id);
  //   if (input) {
  //     const value = parseFloat(input.value);
  //     if (!isNaN(value)) {
  //       total += value;
  //     }
  //   }
  // });
  // const oopExamDisplay = document.getElementById('oopExam');
  // if (oopExamDisplay) {
  //   oopExamDisplay.textContent = total > 0 ? `$${total.toFixed(2)}` : '---';
  // }
}

setupCurrencyInputListener('exam-copay', 'examCopay');
setupCurrencyInputListener('retinal-image', 'retinalImage');
setupCurrencyInputListener('ir-training', 'irTraining');
setupCurrencyInputListener('contact-lens-allowance', 'contactLensAllowanceDisplay', true);
setupCurrencyInputListener('additional-fees', 'additionalFeesDisplay');
setupCurrencyInputListener('additional-savings', 'additionalSavingsDisplay', true);
updateRebateDisplay(rightEyeData, selections.newToBrand);

['fitting-copay', 'fitting-discount-amount', 'fitting-discount-percent'].forEach(id => {
  const input = document.getElementById(id);
  if (input) {
    input.addEventListener('input', () => {
      updateFittingFeeDisplay();
    });
  }
});

const ids = [
  'exam-copay',
  'contact-lens-exam-copay',
  'retinal-image',
  'ir-training',
  'additional-fees'
];

// Attach event listeners to update total on input change
ids.forEach(id => {
  const input = document.getElementById(id);
  if (input) {
    input.addEventListener('input', updateOOPExamTotal);
  }
});

// Initialize total on page load
updateOOPExamTotal();

// Rebate function
function updateRebateDisplay(data, newToBrand) {
  if (!data) {
    console.warn("Missing data.");
    return;
  }

  const isNewToBrand = newToBrand?.toLowerCase() === "yes";
 
  rebate = parseFloat(
    isNewToBrand ? data.rebatesfornewwearer : data.yearsupplycurrent
  ) || 0;

  console.log(
    `Rebate (${isNewToBrand ? "New Wearer" : "Current Wearer"}): $${rebate}`
  );

  // Update existing display element
  const rebateDisplay = document.getElementById("rebateDisplay");
  if (rebateDisplay) {
    rebateDisplay.textContent = `$${rebate.toFixed(2)}`;
  }

  // ✅ ALSO update table cell
  const rebateTableCell = document.getElementById("rebate-display-cell");
  if (rebateTableCell) {
    rebateTableCell.textContent = `$${rebate.toFixed(2)}`;
  }

  // Update the rebate supply text
  const rebateSupply = document.getElementById("rebateSupply");
  const rebateValue = document.getElementById("rebateValue");
  if (rebateSupply) {
    // Determine supply type
    let supplyType = "Year supply";
    const mode = getCurrentSupplyMode();
    if (mode === "six") supplyType = "6 month supply";
    else if (mode === "one") supplyType = "1 box of";
    // Get right eye brand
    const brand = data.brand || "(Brand)";
    rebateSupply.textContent = `${supplyType} of ${brand}`;
    if (rebateValue) {
      rebateValue.textContent = `$${rebate.toFixed(2)}`;
    }
  }

  return rebate;
}

// Update rebate supply text when supply mode or right eye brand changes
function updateRebateSupplyText() {
  const rebateSupply = document.getElementById("rebateSupply");
  const rebateValue = document.getElementById("rebateValue");
  if (rebateSupply) {
    let supplyType = "Year supply";
    const mode = getCurrentSupplyMode();
    if (mode === "six") supplyType = "6 month supply";
    else if (mode === "one") supplyType = "1 box of";
    const brand = rightEyeData && rightEyeData.brand ? rightEyeData.brand : "(Brand)";
    rebateSupply.textContent = `${supplyType} of ${brand}`;
    if (rebateValue) {
      rebateValue.textContent = `$${rebate.toFixed(2)}`;
    }
  }
}

// Hook into supply button changes and right eye brand changes
const supplyBtns = [
  document.getElementById('year-supply-btn'),
  document.getElementById('six-month-btn'),
  document.getElementById('one-box-btn'),
  document.getElementById('clear-supply-btn')
];
supplyBtns.forEach(btn => {
  if (btn) {
    btn.addEventListener('click', updateRebateSupplyText);
  }
});

// When right eye brand changes, update rebate supply text
// (populateDropdown already sets rightEyeData and calls updateBoxesDisplay, so add updateRebateSupplyText there)
const origUpdateBoxesDisplay = updateBoxesDisplay;
updateBoxesDisplay = function() {
  origUpdateBoxesDisplay();
  updateRebateSupplyText();
};

let fittingFee = null;

(function() {
  let _fittingFee = null;
  Object.defineProperty(window, 'fittingFee', {
    get() { return _fittingFee; },
    set(val) {
      _fittingFee = val;
      updateFittingFeeDisplay();
    }
  });
})();

function determineFittingFee(selections, fittingFeesData) {
  const { fittingType, selfPay, newEst } = selections;

  console.log('--- FITTING FEE DEBUG ---');
  console.log('Selections:', selections);
  console.log('fittingFeesData:', fittingFeesData);

  if ([fittingType, selfPay, newEst].some(val => val === undefined)) {
    console.log('Missing selection for fittingType, selfPay, or newEst.');
    return;
  }

  let dataIndex;
  if (fittingType === 'Sphere') {
    dataIndex = 0;
  } else if (fittingType === 'Toric') {
    dataIndex = 1;
  } else if (fittingType === 'MF/Mono') {
    dataIndex = 2;
  } else {
    console.warn("Invalid fittingType provided.");
    return;
  }

  const feeData = fittingFeesData[dataIndex];
  console.log('feeData:', feeData);

  if (selfPay === 'Yes') {
    fittingFee = feeData.selfpay;
  } else if (selfPay === 'No') {
    if (newEst === 'New') {
      fittingFee = feeData.insnew;
    } else if (newEst === 'Est') {
      fittingFee = feeData.insestablished;
    }
  } else {
    console.warn("Invalid selections.selfPay");
  }

  console.log('Baseline fitting fee (from patient details):', fittingFee);
  updateFittingFeeDisplay();
  console.log('--- END FITTING FEE DEBUG ---');
}

function calculateFinalFittingFee() {
  // Determine which fitting fee button is selected
  const copayBtn = document.getElementById('fitting-copay-btn');
  const percentBtn = document.getElementById('fitting-percent-btn');
  const dollarBtn = document.getElementById('fitting-dollar-btn');
  const copayInput = parseFloat(document.getElementById('fitting-copay-input')?.value) || 0;
  const percentInput = parseFloat(document.getElementById('fitting-percent-input')?.value) || 0;
  const dollarInput = parseFloat(document.getElementById('fitting-dollar-input')?.value) || 0;

  console.log('--- CALCULATE FINAL FITTING FEE DEBUG ---');
  console.log('copayBtn.selected:', copayBtn && copayBtn.classList.contains('selected'));
  console.log('percentBtn.selected:', percentBtn && percentBtn.classList.contains('selected'));
  console.log('dollarBtn.selected:', dollarBtn && dollarBtn.classList.contains('selected'));
  console.log('copayInput:', copayInput);
  console.log('percentInput:', percentInput);
  console.log('dollarInput:', dollarInput);
  console.log('fittingFee:', fittingFee);

  if (!fittingFee) {
    console.log('No fittingFee set, returning 0');
    return 0; // Prevent NaN if fittingFee is not set yet
  }

  if (copayBtn && copayBtn.classList.contains('selected')) {
    console.log('Returning copayInput');
    return copayInput;
  }
  if (percentBtn && percentBtn.classList.contains('selected')) {
    console.log('Returning percent discount');
    return fittingFee * (1 - percentInput / 100);
  }
  if (dollarBtn && dollarBtn.classList.contains('selected')) {
    console.log('Returning dollar discount');
    return fittingFee - dollarInput;
  }
  console.log('Returning base fittingFee');
  return fittingFee;
}

function updateFittingFeeDisplay() {
  if (fittingFee == null) return; // wait till fittingFee is set

  const finalFee = calculateFinalFittingFee();
  console.log('Final fitting fee (after copay/discount logic):', finalFee);
  document.getElementById("clExam").textContent = `$${finalFee.toFixed(2)}`;

  // 🔁 Recalculate OOP total after updating CL exam fee
  updateOOPExamTotal();
  // 🔁 Also update the exam subtotal
  updateExamDetailsTable();
}

// List of input IDs to watch for changes
const inputIds = [
  'boxes1',
  'price1',
  'boxes2',
  'price2',
  'contact-lens-allowance',
  'additional-savings'
];

// Attach 'input' event listeners to all relevant inputs
inputIds.forEach(id => {
  const input = document.getElementById(id);
  if (input) {
    input.addEventListener('input', updateOOPContactsTotal(rebate));
  }
});

// Call once on page load to initialize display
document.addEventListener('DOMContentLoaded', updateOOPContactsTotal(rebate));

function parseDollarAmount(text) {
  // Remove $ and commas, parse float
  return parseFloat(text.replace(/[^0-9.-]+/g, '')) || 0;
}

function updateOOPContactsTotal(rebate) {
  // Get numbers from display elements
  const boxesRight = parseDollarAmount(document.getElementById('boxes1').textContent);
  const boxesLeft = parseDollarAmount(document.getElementById('boxes2').textContent);
  const priceRight = parseDollarAmount(document.getElementById('price1').textContent);
  const priceLeft = parseDollarAmount(document.getElementById('price2').textContent);
  const contactLensAllowance = parseDollarAmount(document.getElementById('contactLensAllowanceDisplay').textContent);
  const additionalSavings = parseDollarAmount(document.getElementById('additionalSavingsDisplay').textContent);

  // Calculate total price before discounts
  const totalPriceRight = boxesRight * priceRight;
  const totalPriceLeft = boxesLeft * priceLeft;
  const totalPrice = totalPriceRight + totalPriceLeft;

  // Apply discounts

  const oopContactsTotal = totalPrice ;

  // Make sure total is never negative
  const finalTotal = Math.max(0, oopContactsTotal);

  // Update the display
  document.getElementById('oopContacts').textContent = `$${finalTotal.toFixed(2)}`;

  console.log(`OOP Contacts Total: $${finalTotal.toFixed(2)}`);

  console.log(`${rebate}`);
  afterRebateTotal = finalTotal - rebate;
  console.log(`After Rebate Total: $${afterRebateTotal.toFixed(2)}`);

  // (Optional) Update other related fields here if needed
  updateFinalOOP();
}

function attachDropdownListeners() {
  const rightSelect = document.querySelector('#right-eye-dropdown select');
  const leftSelect = document.querySelector('#left-eye-dropdown select');

  if (rightSelect) {
    rightSelect.addEventListener('change', () => {
      updateOOPContactsTotal();
    });
  }

  if (leftSelect) {
    leftSelect.addEventListener('change', () => {
      updateOOPContactsTotal();
    });
  }
}

// Add sign out functionality
function signOut() {
    isAuthenticated = false;
    userEmail = null;
    google.accounts.id.disableAutoSelect();
    // Show login overlay
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('main-content').classList.add('d-none');
    // Clear any sensitive data
    data.length = 0;
    rightEyeData = [];
    leftEyeData = [];
    rebate = [];
}

// Add JWT decode library
document.head.appendChild(document.createElement('script')).src = 'https://cdn.jsdelivr.net/npm/jwt-decode@3.1.2/build/jwt-decode.min.js';

// Add copy to left eye functionality
document.getElementById('copy-to-left-eye').addEventListener('click', () => {
    // Get the selected manufacturer from right eye
    const rightManufacturerBtn = document.querySelector('.manufacturer-btn[data-eye="right"].selected');
    if (!rightManufacturerBtn) {
        alert('Please select a manufacturer for the right eye first.');
        return;
    }
    const manufacturer = rightManufacturerBtn.dataset.manufacturer;

    // Get the selected brand from right eye dropdown
    const rightBrandSelect = document.querySelector('#right-eye-dropdown select');
    if (!rightBrandSelect || !rightBrandSelect.value) {
        alert('Please select a brand for the right eye first.');
        return;
    }
    const brand = rightBrandSelect.value;

    // Select the same manufacturer for left eye
    const leftManufacturerBtn = document.querySelector(`.manufacturer-btn[data-eye="left"][data-manufacturer="${manufacturer}"]`);
    if (leftManufacturerBtn) {
        // Deselect all left eye manufacturer buttons
        document.querySelectorAll('.manufacturer-btn[data-eye="left"]').forEach(btn => {
            btn.classList.remove('selected');
        });
        // Select the matching manufacturer button
        leftManufacturerBtn.classList.add('selected');
        // Trigger the manufacturer button click to update the brand dropdown
        leftManufacturerBtn.click();
    }

    // Wait for the brand dropdown to update
    setTimeout(() => {
        // Select the same brand in left eye dropdown
        const leftBrandSelect = document.querySelector('#left-eye-dropdown select');
        if (leftBrandSelect) {
            leftBrandSelect.value = brand;
            // Trigger change event to update pricing
            leftBrandSelect.dispatchEvent(new Event('change'));
        }
    }, 100);
});

document.addEventListener('DOMContentLoaded', function() {
  // Supply button toggle logic
  const supplyBtns = [
    document.getElementById('year-supply-btn'),
    document.getElementById('six-month-btn'),
    document.getElementById('one-box-btn'),
    document.getElementById('clear-supply-btn')
  ];
  function selectSupplyBtn(selectedBtn) {
    supplyBtns.forEach(btn => btn.classList.remove('selected'));
    if (selectedBtn && selectedBtn.id !== 'clear-supply-btn') {
      selectedBtn.classList.add('selected');
    }
  }
  supplyBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.id === 'clear-supply-btn') {
        // Deselect all manufacturer buttons
        document.querySelectorAll('.manufacturer-btn.selected').forEach(btn => btn.classList.remove('selected'));
        // Reset both brand dropdowns to default
        const rightBrandSelect = document.querySelector('#right-eye-dropdown select');
        if (rightBrandSelect) rightBrandSelect.selectedIndex = 0;
        const leftBrandSelect = document.querySelector('#left-eye-dropdown select');
        if (leftBrandSelect) leftBrandSelect.selectedIndex = 0;
        // Deselect all supply buttons
        supplyBtns.forEach(b => b.classList.remove('selected'));
        // Optionally, clear price/box/brand display for both eyes
        document.getElementById('brand1').textContent = '(Not selected)';
        document.getElementById('brand2').textContent = '(Not selected)';
        document.getElementById('price1').textContent = '$0.00';
        document.getElementById('price2').textContent = '$0.00';
        document.getElementById('boxes1').textContent = '0';
        document.getElementById('boxes2').textContent = '0';
        updateOOPContactsTotal();
        return;
      }
      selectSupplyBtn(this);
      updateBoxesDisplay();
    });
  });
  // Default: Year Supply selected
  if (supplyBtns[0]) supplyBtns[0].classList.add('selected');

  // Signature pad logic
  const canvas = document.getElementById('signature-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let lastX = 0;
    let lastY = 0;

    function getOffset(e) {
      const rect = canvas.getBoundingClientRect();
      let x, y;
      if (e.touches && e.touches.length === 1) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
      } else if (e.changedTouches && e.changedTouches.length === 1) {
        x = e.changedTouches[0].clientX - rect.left;
        y = e.changedTouches[0].clientY - rect.top;
      } else {
        x = e.offsetX;
        y = e.offsetY;
      }
      // Scale to canvas coordinate system
      x = x * (canvas.width / rect.width);
      y = y * (canvas.height / rect.height);
      return { x, y };
    }

    function startDraw(e) {
      drawing = true;
      const { x, y } = getOffset(e);
      lastX = x;
      lastY = y;
      e.preventDefault();
    }
    function draw(e) {
      if (!drawing) return;
      const { x, y } = getOffset(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
      lastX = x;
      lastY = y;
      e.preventDefault();
    }
    function endDraw(e) {
      drawing = false;
      e.preventDefault();
    }
    // Mouse events
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    // Touch events
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw, { passive: false });
    // Clear button
    const clearBtn = document.getElementById('clear-signature-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }
  }

  // Print button logic
  const printBtn = document.getElementById('print-signature-btn');
  if (printBtn) {
    printBtn.addEventListener('click', function() {
      window.print();
    });
  }

  // Fitting Fee Button Toggle Logic
  const fittingFeeBtns = [
    document.getElementById('fitting-copay-btn'),
    document.getElementById('fitting-percent-btn'),
    document.getElementById('fitting-dollar-btn'),
    document.getElementById('fitting-none-btn')
  ];
  const fittingInputs = [
    document.getElementById('fitting-copay-input'),
    document.getElementById('fitting-percent-input'),
    document.getElementById('fitting-dollar-input')
  ];
  fittingFeeBtns.forEach((btn, idx) => {
    btn.addEventListener('click', function() {
      // Deselect all buttons
      fittingFeeBtns.forEach(b => b.classList.remove('selected'));
      // Hide all inputs
      fittingInputs.forEach(input => input.style.display = 'none');
      // Always select the clicked button
      btn.classList.add('selected');
      // If not 'None', show its input
      if (btn.id !== 'fitting-none-btn') {
        fittingInputs[idx].style.display = '';
      }
    });
  });
  // On initial load, no button is selected and all inputs are hidden
  fittingFeeBtns.forEach(b => b.classList.remove('selected'));
  fittingInputs.forEach(input => input.style.display = 'none');
});

// Helper to get current supply mode
function getCurrentSupplyMode() {
  if (document.getElementById('year-supply-btn')?.classList.contains('selected')) return 'year';
  if (document.getElementById('six-month-btn')?.classList.contains('selected')) return 'six';
  if (document.getElementById('one-box-btn')?.classList.contains('selected')) return 'one';
  return 'year'; // default
}

// Helper to calculate boxes based on supply mode
function calculateBoxes(boxesForYear) {
  const mode = getCurrentSupplyMode();
  if (mode === 'year') return boxesForYear;
  if (mode === 'six') return boxesForYear / 2;
  if (mode === 'one') return 1;
  return boxesForYear;
}

// Update boxes display for both eyes
function updateBoxesDisplay() {
  // Right Eye
  if (rightEyeData && rightEyeData['#ofboxesforyearsupply']) {
    const boxesForYear = parseInt(rightEyeData['#ofboxesforyearsupply']) / 2;
    const boxes = calculateBoxes(boxesForYear);
    document.getElementById('boxes1').textContent = isNaN(boxes) ? "0" : boxes;
  }
  // Left Eye
  if (leftEyeData && leftEyeData['#ofboxesforyearsupply']) {
    const boxesForYear = parseInt(leftEyeData['#ofboxesforyearsupply']) / 2;
    const boxes = calculateBoxes(boxesForYear);
    document.getElementById('boxes2').textContent = isNaN(boxes) ? "0" : boxes;
  }
  updateOOPContactsTotal();
}

function updateFinalOOP() {
  // Get the three subtotals
  const examSubtotal = parseFloat(document.getElementById('examDetailsSubtotal').textContent.replace(/[^0-9.-]+/g, '')) || 0;
  const contactLensSubtotal = parseFloat(document.getElementById('oopContacts').textContent.replace(/[^0-9.-]+/g, '')) || 0;
  const deductionsSubtotal = parseFloat(document.getElementById('deductionsSubtotal').textContent.replace(/[^0-9.-]+/g, '')) || 0;
  // Deductions subtotal is already negative, so just add it
  const finalOOP = examSubtotal + contactLensSubtotal + deductionsSubtotal;
  document.getElementById('finalOOP').textContent = `$${finalOOP.toFixed(2)}`;
}

// Ensure updateFinalOOP and updateFinalCostPerBox are called after updateDeductionsSubtotal and updateExamDetailsTable
const origUpdateDeductionsSubtotal = updateDeductionsSubtotal;
updateDeductionsSubtotal = function() {
  origUpdateDeductionsSubtotal();
  updateFinalOOP();
  updateFinalCostPerBox();
};
const origUpdateExamDetailsTable = updateExamDetailsTable;
updateExamDetailsTable = function() {
  origUpdateExamDetailsTable();
  updateFinalOOP();
};

['examCopay', 'clExam', 'retinalImage', 'irTraining', 'additionalFeesDisplay', 'contactLensAllowanceDisplay', 'additionalSavingsDisplay', 'oopContacts'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('DOMSubtreeModified', function() {
      updateFinalOOP();
    });
  }
});

['fitting-copay-input', 'fitting-percent-input', 'fitting-dollar-input'].forEach(id => {
  const input = document.getElementById(id);
  if (input) {
    input.addEventListener('input', () => {
      window.finalFittingFee = calculateFinalFittingFee();
    });
  }
});

function updateFinalCostPerBox() {
  // Get values from the DOM
  const contactLensSubtotal = parseFloat(document.getElementById('oopContacts').textContent.replace(/[^0-9.-]+/g, '')) || 0;
  const deductionsSubtotal = parseFloat(document.getElementById('deductionsSubtotal').textContent.replace(/[^0-9.-]+/g, '')) || 0;
  // rebate is a global variable
  const boxesRight = parseFloat(document.getElementById('boxes1').textContent) || 0;
  const boxesLeft = parseFloat(document.getElementById('boxes2').textContent) || 0;
  const totalBoxes = boxesRight + boxesLeft;
  // Calculation: (Contact Lens Subtotal + Deductions Subtotal - Rebate) / (right eye boxes + left eye boxes)
  let finalCost = 0;
  if (totalBoxes > 0) {
    finalCost = (contactLensSubtotal + deductionsSubtotal - rebate) / totalBoxes;
  }
  document.getElementById('finalCostPerBox').textContent = isNaN(finalCost) ? '$0.00' : `$${finalCost.toFixed(2)}`;
}

// Call updateFinalCostPerBox whenever relevant values change
const origUpdateOOPContactsTotal = updateOOPContactsTotal;
updateOOPContactsTotal = function(rebate) {
  origUpdateOOPContactsTotal(rebate);
  updateFinalCostPerBox();
};
const origUpdateRebateDisplay = updateRebateDisplay;
updateRebateDisplay = function(data, newToBrand) {
  const result = origUpdateRebateDisplay(data, newToBrand);
  updateFinalCostPerBox();
  return result;
};

// Add event listeners to fitting fee buttons and inputs to update fitting fee display
['fitting-copay-btn', 'fitting-percent-btn', 'fitting-dollar-btn', 'fitting-none-btn'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener('click', () => {
      determineFittingFee(selections, fittingFeesData);
    });
  }
});
['fitting-copay-input', 'fitting-percent-input', 'fitting-dollar-input'].forEach(id => {
  const input = document.getElementById(id);
  if (input) {
    input.addEventListener('input', () => {
      determineFittingFee(selections, fittingFeesData);
    });
  }
});


