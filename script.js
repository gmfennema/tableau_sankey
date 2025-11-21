const ACCENT_COLOR = '#1E74FF';

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
  
  // Add event listener for color mode changes
  document.querySelectorAll('input[name="colorMode"]').forEach(radio => {
      radio.addEventListener('change', () => {
          updateNodeColorsMapping();
      });
  });
  
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
      
      // Show color matching mode section
      document.getElementById('colorMatchingMode').classList.remove('hidden');
      
      // Add event listener for color mode changes
      document.querySelectorAll('input[name="colorMode"]').forEach(radio => {
          radio.addEventListener('change', () => {
              updateNodeColorsMapping();
          });
      });
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
      
      // Get the selected color matching mode
      const colorMode = document.querySelector('input[name="colorMode"]:checked')?.value || 'exact';
      
      // Populate the nodeColorsMapping container based on the selected mode
      const nodeColorsMappingContainer = document.getElementById('nodeColorsMapping');
      nodeColorsMappingContainer.innerHTML = '';
      
      if (colorMode === 'exact') {
          // Exact match mode: show color picker for each node
          const title = document.createElement('h3');
          title.className = 'group-title';
          title.textContent = 'Node Colors';
          nodeColorsMappingContainer.appendChild(title);
          nodes.forEach(node => {
              const row = document.createElement('div');
              row.className = 'node-color-row';

              const label = document.createElement('span');
              label.className = 'node-color-label';
              label.textContent = node;

              const colorInput = document.createElement('input');
              colorInput.type = 'color';
              colorInput.value = ACCENT_COLOR;
              colorInput.dataset.nodeLabel = node;
              colorInput.className = 'color-chip';

              row.appendChild(label);
              row.appendChild(colorInput);
              nodeColorsMappingContainer.appendChild(row);
          });
      } else {
          // Pattern match mode: show pattern input and color picker pairs
          const title = document.createElement('h3');
          title.className = 'group-title';
          title.textContent = 'Color Patterns';
          nodeColorsMappingContainer.appendChild(title);
          
          // Add a button to add new pattern rules
          const addPatternBtn = document.createElement('button');
          addPatternBtn.type = 'button';
          addPatternBtn.textContent = '+ Add Pattern Rule';
          addPatternBtn.className = 'ghost-button add-pattern-btn';
          addPatternBtn.addEventListener('click', () => {
              addPatternRule();
          });
          nodeColorsMappingContainer.appendChild(addPatternBtn);
          
          // Add initial pattern rule
          addPatternRule();
      }
      
      // Unhide the node colors section
      nodeColorsMappingContainer.classList.remove('hidden');
  } catch (error) {
      console.error("Error updating node colors mapping:", error);
  }
}

/**
 * Adds a pattern rule input row to the color mapping container
 */
function addPatternRule(pattern = '', color = ACCENT_COLOR) {
  const nodeColorsMappingContainer = document.getElementById('nodeColorsMapping');
  const patternDiv = document.createElement('div');
  patternDiv.className = 'pattern-rule';
  
  const patternInput = document.createElement('input');
  patternInput.type = 'text';
  patternInput.placeholder = 'Enter pattern (e.g., "Marketing", "Sales")';
  patternInput.value = pattern;
  patternInput.className = 'text-input';
  
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = color;
  colorInput.className = 'color-chip';
  
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = 'Remove';
  removeBtn.className = 'ghost-button ghost-danger';
  removeBtn.addEventListener('click', () => {
      patternDiv.remove();
  });
  
  patternDiv.appendChild(patternInput);
  patternDiv.appendChild(colorInput);
  patternDiv.appendChild(removeBtn);
  nodeColorsMappingContainer.appendChild(patternDiv);
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
  
  // Get the selected color matching mode
  const colorMode = document.querySelector('input[name="colorMode"]:checked')?.value || 'exact';
  
  // Retrieve node color selections from the UI based on mode
  let nodeColors = {};
  let colorPatterns = [];
  
  if (colorMode === 'exact') {
      // Exact match mode: collect colors by exact node label
      document.querySelectorAll('#nodeColorsMapping input[type="color"]').forEach(input => {
          let nodeLabel = input.dataset.nodeLabel;
          nodeColors[nodeLabel] = input.value;
      });
  } else {
      // Pattern match mode: collect pattern rules
      // Select only divs with the pattern-rule class
      const patternDivs = document.querySelectorAll('#nodeColorsMapping .pattern-rule');
      patternDivs.forEach(div => {
          const patternInput = div.querySelector('input[type="text"]');
          const colorInput = div.querySelector('input[type="color"]');
          if (patternInput && colorInput && patternInput.value.trim()) {
              colorPatterns.push({
                  pattern: patternInput.value.trim(),
                  color: colorInput.value
              });
          }
      });
  }
  
  // Save the configuration using Tableau's settings API.
  // Notice we removed chartWidth and chartHeight from config.
  const config = { 
      worksheetName, 
      sourceCol, 
      targetCol, 
      amountCol, 
      colorMode,
      nodeColors: colorMode === 'exact' ? nodeColors : undefined,
      colorPatterns: colorMode === 'pattern' ? colorPatterns : undefined
  };
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
      
      // Create node colors from config based on matching mode
      // Default to 'exact' mode for backward compatibility
      const colorMode = config.colorMode || 'exact';
      const nodeColorsArr = nodeLabels.map(label => {
          if (colorMode === 'pattern' && config.colorPatterns) {
              // Pattern matching mode: find first pattern that matches
              for (const patternRule of config.colorPatterns) {
                  if (label.toLowerCase().includes(patternRule.pattern.toLowerCase())) {
                      return patternRule.color;
                  }
              }
              return ACCENT_COLOR; // Default color if no pattern matches
          } else {
              // Exact matching mode: use exact node label
              return (config.nodeColors && config.nodeColors[label]) ? config.nodeColors[label] : ACCENT_COLOR;
          }
      });
      
      // Configure the Plotly Sankey diagram data
      const data = [{
          type: "sankey",
          orientation: "h",
          node: {
              pad: 15,
              thickness: 30,
              line: { color: "black", width: 0.5 },
              label: nodeLabelsWithTotals,
              color: nodeColorsArr,
              arrangement: "snap",
              thickness: nodeTotals.map(total => 
                  (total / Math.max(...nodeTotals)) * 50
              )
          },
          link: {
              source: links.map(link => link.source),
              target: links.map(link => link.target),
              value: links.map(link => link.value),
              color: links.map(link => {
                  const targetColor = nodeColorsArr[link.target];
                  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(targetColor);
                  const rgb = result ? {
                      r: parseInt(result[1], 16),
                      g: parseInt(result[2], 16),
                      b: parseInt(result[3], 16)
                  } : null;
                  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)` : targetColor;
              })
          }
      }];
      
      // Get the container dimensions
      const chartContainer = document.getElementById('chart');
      const containerWidth = chartContainer.clientWidth;
      const containerHeight = chartContainer.clientHeight || window.innerHeight;  // Fallback if clientHeight is 0
      
      // Adjust layout to maximize space
      const layout = {
          font: { size: 10 },
          width: containerWidth,
          height: containerHeight,
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          margin: {
              l: 5,
              r: 5,
              t: 5,
              b: 5
          }
      };
      
      // Render the chart and add interactivity
      Plotly.newPlot('chart', data, layout).then(gd => {
          // Hide the extension title once the chart is displayed
          const extensionTitle = document.querySelector('h2');
          if (extensionTitle) {
              extensionTitle.style.display = 'none';
          }

          // Store original colors for resetting the view
          gd.originalNodeColors = JSON.parse(JSON.stringify(gd.data[0].node.color));
          gd.originalLinkColors = JSON.parse(JSON.stringify(gd.data[0].link.color));

          gd.on('plotly_click', function(eventData) {
              const chart = gd;
              const selectionState = chart.tag || {}; // Use 'tag' for custom data

              // Function to reset chart to its original, un-dimmed state
              const resetChart = () => {
                  Plotly.restyle(chart, {
                      'node.color': [chart.originalNodeColors],
                      'link.color': [chart.originalLinkColors]
                  });
                  chart.tag = {}; // Clear selection state
              };

              // If the background is clicked or there's no point data, reset the chart
              if (!eventData.points || eventData.points.length === 0) {
                  resetChart();
                  return;
              }

              const clickedPoint = eventData.points[0];
              const clickedIdentifier = {
                  type: clickedPoint.hasOwnProperty('label') ? 'node' : 'link',
                  pointNumber: clickedPoint.pointNumber
              };

              // If the user clicks the same element again, reset the chart
              if (selectionState.identifier && 
                  selectionState.identifier.type === clickedIdentifier.type &&
                  selectionState.identifier.pointNumber === clickedIdentifier.pointNumber) {
                  resetChart();
                  return;
              }

              // A new selection is being made, so calculate dimmed colors
              const DIM_OPACITY = 0.2;
              let newNodeColors = chart.originalNodeColors.map(color => convertToRgba(color, DIM_OPACITY));
              let newLinkColors = chart.originalLinkColors.map(color => convertToRgba(color, DIM_OPACITY));
              const allLinks = chart.data[0].link;

              if (clickedIdentifier.type === 'node') {
                  const nodeIndex = clickedIdentifier.pointNumber;
                  // Highlight the selected node and its connected links and nodes
                  newNodeColors[nodeIndex] = chart.originalNodeColors[nodeIndex];

                  allLinks.source.forEach((source, linkIndex) => {
                      const target = allLinks.target[linkIndex];
                      if (source === nodeIndex || target === nodeIndex) {
                          newLinkColors[linkIndex] = chart.originalLinkColors[linkIndex];
                          newNodeColors[source] = chart.originalNodeColors[source];
                          newNodeColors[target] = chart.originalNodeColors[target];
                      }
                  });
              } else { // 'link'
                  const linkIndex = clickedIdentifier.pointNumber;
                  const sourceNode = allLinks.source[linkIndex];
                  const targetNode = allLinks.target[linkIndex];
                  // Highlight the selected link and its source/target nodes
                  newLinkColors[linkIndex] = chart.originalLinkColors[linkIndex];
                  newNodeColors[sourceNode] = chart.originalNodeColors[sourceNode];
                  newNodeColors[targetNode] = chart.originalNodeColors[targetNode];
              }

              // Apply the new colors to dim/highlight elements
              Plotly.restyle(chart, {
                  'node.color': [newNodeColors],
                  'link.color': [newLinkColors]
              });

              // Save the new selection state
              chart.tag = { identifier: clickedIdentifier };
          });
      });
      
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

/**
 * Converts a color string (hex, rgb) to an rgba string with a specified opacity.
 * @param {string} color The input color string.
 * @param {number} opacity The desired opacity (0.0 to 1.0).
 * @returns {string} The resulting rgba color string.
 */
function convertToRgba(color, opacity) {
    // Handles rgba colors by replacing the existing opacity
    if (color.startsWith('rgba')) {
        return color.replace(/, [0-9.]+?\)$/, `, ${opacity})`);
    }
    // Handles rgb colors by converting them to rgba
    if (color.startsWith('rgb')) {
        return color.replace(')', `, ${opacity})`).replace('rgb', 'rgba');
    }
    // Handles hex colors
    if (color.startsWith('#')) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
        if (result) {
            const r = parseInt(result[1], 16);
            const g = parseInt(result[2], 16);
            const b = parseInt(result[3], 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }
    }
    // Fallback for named colors or other formats that can't be converted
    return color; 
}