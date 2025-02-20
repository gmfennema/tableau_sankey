document.addEventListener('DOMContentLoaded', () => {
  tableau.extensions.initializeAsync().then(() => {
      console.log("Tableau Extension Initialized");
      // Check if configuration settings exist
      const config = tableau.extensions.settings.get("sankeyConfig");
      if (config) {
          try {
              const parsedConfig = JSON.parse(config);
              // Hide the configuration UI if settings exist
              document.getElementById('configSection').classList.add('hidden');
              renderChart(parsedConfig);
          } catch (e) {
              console.error("Error parsing saved configuration, showing configuration UI.", e);
              showConfigUI();
          }
      } else {
          // No saved settings – show configuration UI
          showConfigUI();
      }
  }).catch(error => {
      console.error("Error during initialization:", error);
  });
});

function showConfigUI() {
  document.getElementById('configSection').classList.remove('hidden');
  populateWorksheetDropdown();

  // When a worksheet is selected, populate the column mapping UI
  document.getElementById('worksheetSelect').addEventListener('change', () => {
      populateColumnMapping();
  });
  
  // When source or target column selections change, update the node color pickers
  document.getElementById('sourceSelect').addEventListener('change', updateNodeColorsMapping);
  document.getElementById('targetSelect').addEventListener('change', updateNodeColorsMapping);
  
  // Save configuration when the button is clicked
  document.getElementById('saveConfigBtn').addEventListener('click', () => {
      saveConfiguration();
  });
}

async function populateWorksheetDropdown() {
  try {
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      const worksheetSelect = document.getElementById('worksheetSelect');
      // Clear any existing options (besides the placeholder)
      worksheetSelect.innerHTML = '<option value="" disabled selected>Select Worksheet</option>';
      dashboard.worksheets.forEach(ws => {
          let option = document.createElement('option');
          option.value = ws.name;
          option.text = ws.name;
          worksheetSelect.appendChild(option);
      });
  } catch (error) {
      console.error("Error populating worksheets:", error);
  }
}

async function populateColumnMapping() {
  try {
      const worksheetName = document.getElementById('worksheetSelect').value;
      console.log("Selected worksheet:", worksheetName);
      if (!worksheetName) return;
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      const worksheet = dashboard.worksheets.find(ws => ws.name === worksheetName);
      if (!worksheet) {
          console.error("Worksheet not found");
          return;
      }
      // Retrieve one row of summary data to obtain column headers
      const options = { maxRows: 1, ignoreSelection: true };
      const dataTable = await worksheet.getSummaryDataAsync(options);
      const columns = dataTable.columns.map(col => col.fieldName);

      // Populate the dropdowns for source, target, and amount
      const sourceSelect = document.getElementById('sourceSelect');
      const targetSelect = document.getElementById('targetSelect');
      const amountSelect = document.getElementById('amountSelect');
      
      sourceSelect.innerHTML = '<option value="" disabled selected>Select Source Column</option>';
      targetSelect.innerHTML = '<option value="" disabled selected>Select Target Column</option>';
      amountSelect.innerHTML = '<option value="" disabled selected>Select Amount Column</option>';
      
      columns.forEach(col => {
          const option1 = document.createElement('option');
          option1.value = col;
          option1.text = col;
          sourceSelect.appendChild(option1);
          
          const option2 = document.createElement('option');
          option2.value = col;
          option2.text = col;
          targetSelect.appendChild(option2);
          
          const option3 = document.createElement('option');
          option3.value = col;
          option3.text = col;
          amountSelect.appendChild(option3);
      });
      
      // Reveal the column mapping section
      document.getElementById('columnMapping').classList.remove('hidden');
  } catch (error) {
      console.error("Error populating column mapping:", error);
  }
}

/**
* Updates the node color mapping UI by fetching all data from the selected worksheet,
* computing the unique set of nodes from the selected source and target columns,
* and creating a color picker for each.
*/
async function updateNodeColorsMapping() {
  const worksheetName = document.getElementById('worksheetSelect').value;
  const sourceCol = document.getElementById('sourceSelect').value;
  const targetCol = document.getElementById('targetSelect').value;
  if (!worksheetName || !sourceCol || !targetCol) return;
  try {
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      const worksheet = dashboard.worksheets.find(ws => ws.name === worksheetName);
      if (!worksheet) {
          console.error("Worksheet not found");
          return;
      }
      // Retrieve all summary data from the worksheet
      const options = { maxRows: 1000000, ignoreSelection: true };
      const dataTable = await worksheet.getSummaryDataAsync(options);
      
      // Find the column indices for the selected source and target columns
      const columns = dataTable.columns.map((col, index) => ({ fieldName: col.fieldName, index }));
      const sourceIndex = columns.find(col => col.fieldName === sourceCol)?.index;
      const targetIndex = columns.find(col => col.fieldName === targetCol)?.index;
      if (sourceIndex === undefined || targetIndex === undefined) {
          return;
      }
      
      // Collect all unique nodes from both source and target columns
      let nodeSet = new Set();
      dataTable.data.forEach(row => {
          const sourceValue = row[sourceIndex].formattedValue;
          const targetValue = row[targetIndex].formattedValue;
          nodeSet.add(sourceValue);
          nodeSet.add(targetValue);
      });
      const nodes = Array.from(nodeSet);
      
      // Populate the nodeColorsMapping container with a color picker for each node
      const nodeColorsMappingContainer = document.getElementById('nodeColorsMapping');
      nodeColorsMappingContainer.innerHTML = '<p>Select Node Colors:</p>';
      nodes.forEach(node => {
          const label = document.createElement('label');
          label.textContent = node + ": ";
          const colorInput = document.createElement('input');
          colorInput.type = 'color';
          // Set default to blue (#0000FF) – you can change this default if desired
          colorInput.value = "#0000FF";
          // Store the node name in a data attribute so we can retrieve it later
          colorInput.dataset.nodeLabel = node;
          nodeColorsMappingContainer.appendChild(label);
          nodeColorsMappingContainer.appendChild(colorInput);
          nodeColorsMappingContainer.appendChild(document.createElement('br'));
      });
      // Unhide the node colors section
      nodeColorsMappingContainer.classList.remove('hidden');
  } catch (error) {
      console.error("Error updating node colors mapping:", error);
  }
}

async function saveConfiguration() {
  // Retrieve selected values from the UI
  const worksheetName = document.getElementById('worksheetSelect').value;
  const sourceCol = document.getElementById('sourceSelect').value;
  const targetCol = document.getElementById('targetSelect').value;
  const amountCol = document.getElementById('amountSelect').value;
  
  if (!worksheetName || !sourceCol || !targetCol || !amountCol) {
      alert("Please select a worksheet and map all three columns.");
      return;
  }
  
  // Retrieve node color selections from the UI
  let nodeColors = {};
  document.querySelectorAll('#nodeColorsMapping input[type="color"]').forEach(input => {
      let nodeLabel = input.dataset.nodeLabel;
      nodeColors[nodeLabel] = input.value;
  });
  
  // Save the configuration using Tableau's settings API.
  // Notice we removed chartWidth and chartHeight from config.
  const config = { worksheetName, sourceCol, targetCol, amountCol, nodeColors };
  tableau.extensions.settings.set("sankeyConfig", JSON.stringify(config));
  await tableau.extensions.settings.saveAsync();
  
  // Hide the configuration UI and render the chart
  document.getElementById('configSection').classList.add('hidden');
  renderChart(config);
}

// Updated function: subscribeToFilterChanges() remains unchanged
function subscribeToFilterChanges(worksheet, config) {
  worksheet.addEventListener(tableau.TableauEventType.FilterChanged, () => {
      console.log('A filter has changed, updating chart...');
      renderChart(config);
  });
}

// New function to subscribe to parameter changes
function subscribeToParameterChanges(config) {
  tableau.extensions.dashboardContent.dashboard.getParametersAsync().then(parameters => {
      parameters.forEach(parameter => {
          parameter.addEventListener(tableau.TableauEventType.ParameterChanged, () => {
              console.log('A parameter has changed, updating chart...');
              renderChart(config);
          });
      });
  }).catch(error => {
      console.error("Error subscribing to parameter changes:", error);
  });
}

// Modified renderChart function to include parameter change subscriptions
async function renderChart(config) {
  try {
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      const worksheet = dashboard.worksheets.find(ws => ws.name === config.worksheetName);
      if (!worksheet) {
          console.error("Worksheet not found for rendering chart.");
          return;
      }
      
      // Subscribe to filter and parameter changes
      subscribeToFilterChanges(worksheet, config);
      subscribeToParameterChanges(config);
      
      // Retrieve all summary data from the worksheet
      const options = { maxRows: 1000000, ignoreSelection: true };
      const dataTable = await worksheet.getSummaryDataAsync(options);
      
      // Build columns map and indices
      const columns = dataTable.columns.map((col, index) => ({ fieldName: col.fieldName, index }));
      const sourceIndex = columns.find(col => col.fieldName === config.sourceCol)?.index;
      const targetIndex = columns.find(col => col.fieldName === config.targetCol)?.index;
      const amountIndex = columns.find(col => col.fieldName === config.amountCol)?.index;
      if (sourceIndex === undefined || targetIndex === undefined || amountIndex === undefined) {
          console.error("One or more selected columns not found in data.");
          return;
      }
      
      // Process data into flows for the Sankey diagram
      let flows = {};
      dataTable.data.forEach(row => {
          const sourceValue = row[sourceIndex].formattedValue;
          const targetValue = row[targetIndex].formattedValue;
          const amountValue = parseFloat(row[amountIndex].value);
          if (isNaN(amountValue) || amountValue === 0) return; // Skip invalid/zero flows
          
          const key = sourceValue + '||' + targetValue;
          if (!flows[key]) {
              flows[key] = { source: sourceValue, target: targetValue, amount: 0 };
          }
          flows[key].amount += amountValue;
      });
      
      // Create a unique nodes object with index references
      let nodes = {};
      Object.values(flows).forEach(flow => {
          if (!(flow.source in nodes)) {
              nodes[flow.source] = Object.keys(nodes).length;
          }
          if (!(flow.target in nodes)) {
              nodes[flow.target] = Object.keys(nodes).length;
          }
      });
      
      // Build links array for Plotly
      let links = [];
      Object.values(flows).forEach(flow => {
          links.push({
              source: nodes[flow.source],
              target: nodes[flow.target],
              value: flow.amount
          });
      });
      
      // Create original node labels and compute totals
      const nodeLabels = Object.keys(nodes);
      let inFlow = new Array(nodeLabels.length).fill(0);
      let outFlow = new Array(nodeLabels.length).fill(0);
      links.forEach(link => {
          outFlow[link.source] += link.value;
          inFlow[link.target] += link.value;
      });
      const nodeTotals = nodeLabels.map((label, i) => Math.max(inFlow[i], outFlow[i]));
      const nodeLabelsWithTotals = nodeLabels.map((label, i) => `${label} (${nodeTotals[i]})`);
      
      // Create node colors from config with a default fallback
      const nodeColorsArr = nodeLabels.map(label => {
          return (config.nodeColors && config.nodeColors[label]) ? config.nodeColors[label] : "#0000FF";
      });
      
      // Configure the Plotly Sankey diagram data (pass a default link color)
      const data = [{
          type: "sankey",
          orientation: "h",
          node: {
              pad: 15,
              thickness: 20,
              line: { color: "black", width: 0.5 },
              label: nodeLabelsWithTotals,
              color: nodeColorsArr
          },
          link: {
              source: links.map(link => link.source),
              target: links.map(link => link.target),
              value: links.map(link => link.value),
              // Use a dummy color; we will override with gradients below
              color: links.map(() => "#AAAAAA")
          }
      }];
      
      // Instead of using static dimensions from config, get dynamic sizing from the container
      const chartContainer = document.getElementById('chart');
      const layout = {
          font: { size: 10 },
          width: chartContainer.clientWidth,   // Use the container's current width
          height: chartContainer.clientHeight  // And current height
      };
      
      // Render the chart and then post-process its SVG for gradient fills on links
      Plotly.newPlot('chart', data, layout).then(gd => {
          // Obtain the SVG element in the Plotly graph div
          let svg = gd.querySelector('svg');
          let defs = svg.querySelector('defs');
          if (!defs) {
              // Create <defs> if it doesn't exist
              defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
              svg.insertBefore(defs, svg.firstChild);
          }
          
          // Select all link path elements (ordered as in the data array)
          const linkPaths = svg.querySelectorAll('.sankey-link path');
          linkPaths.forEach((path, i) => {
              if (i >= links.length) return; 
              
              // For each link get the corresponding source and target colors
              const currentLink = links[i];
              const sourceColor = nodeColorsArr[currentLink.source];
              const targetColor = nodeColorsArr[currentLink.target];
              
              // Create a unique linearGradient id
              const gradientId = "gradient" + i;
              let linearGradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
              linearGradient.setAttribute("id", gradientId);
              linearGradient.setAttribute("gradientUnits", "userSpaceOnUse");
              // Set a horizontal gradient direction (left-to-right)
              linearGradient.setAttribute("x1", "0%");
              linearGradient.setAttribute("y1", "0%");
              linearGradient.setAttribute("x2", "100%");
              linearGradient.setAttribute("y2", "0%");
              
              // Define gradient stops at 0% and 100%
              let stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
              stop1.setAttribute("offset", "0%");
              stop1.setAttribute("stop-color", sourceColor);
              let stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
              stop2.setAttribute("offset", "100%");
              stop2.setAttribute("stop-color", targetColor);
              
              linearGradient.appendChild(stop1);
              linearGradient.appendChild(stop2);
              defs.appendChild(linearGradient);
              
              // Update the current link's fill to the gradient
              path.setAttribute("fill", `url(#${gradientId})`);
          });
      });
      
      // Hide the extension title once the chart is displayed
      const extensionTitle = document.querySelector('h2');
      if (extensionTitle) {
          extensionTitle.style.display = 'none';
      }
      
  } catch (error) {
      console.error("Error rendering Sankey chart:", error);
  }
}

// Dynamically update the chart when the window is resized
window.addEventListener('resize', () => {
  const configStr = tableau.extensions.settings.get("sankeyConfig");
  if (configStr) {
       const config = JSON.parse(configStr);
       renderChart(config);
  }
});