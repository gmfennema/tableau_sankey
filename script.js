document.addEventListener('DOMContentLoaded', () => {
    tableau.extensions.initializeAsync().then(() => {
      // Check if a configuration has already been saved.
      const configStr = tableau.extensions.settings.get("sankeyConfig");
      if (configStr) {
        const config = JSON.parse(configStr);
        // If config is saved, hide the config UI and render the chart.
        document.getElementById('configSection').classList.add('hidden');
        renderChart(config);
      } else {
        showConfigUI();
      }
    }).catch(err => {
      console.error("Error initializing extension:", err);
    });
  
    // Re-render the chart on window resize.
    window.addEventListener('resize', () => {
      const configStr = tableau.extensions.settings.get("sankeyConfig");
      if (configStr) {
        const config = JSON.parse(configStr);
        renderChart(config);
      }
    });
  });
  
  function showConfigUI() {
    document.getElementById('configSection').classList.remove('hidden');
    populateWorksheetDropdown();
  
    // When a worksheet is selected, populate the column mapping UI
    document.getElementById('worksheetSelect').addEventListener('change', () => {
      const worksheetName = document.getElementById('worksheetSelect').value;
      if (worksheetName) {
        document.getElementById('columnMapping').classList.remove('hidden');
        populateColumnMapping();
      }
    });
  
    // Modify save configuration to include color settings
    document.getElementById('saveConfigBtn').addEventListener('click', () => {
        const worksheetName = document.getElementById('worksheetSelect').value;
        const sourceCol = document.getElementById('sourceSelect').value;
        const targetCol = document.getElementById('targetSelect').value;
        const amountCol = document.getElementById('amountSelect').value;

        // Collect color settings
        const nodeColors = [
            document.getElementById('node1Color').value,
            document.getElementById('node2Color').value,
            document.getElementById('node3Color').value,
            document.getElementById('node4Color').value
        ];

        if (!worksheetName || !sourceCol || !targetCol || !amountCol) {
            alert("Please select a worksheet and map all columns.");
            return;
        }

        const config = { 
            worksheetName, 
            sourceCol, 
            targetCol, 
            amountCol,
            nodeColors 
        };
        tableau.extensions.settings.set("sankeyConfig", JSON.stringify(config));
        tableau.extensions.settings.saveAsync().then(() => {
            document.getElementById('configSection').classList.add('hidden');
            renderChart(config);
        });
    });
  }
  
  function populateWorksheetDropdown() {
    const dashboard = tableau.extensions.dashboardContent.dashboard;
    const wsSelect = document.getElementById('worksheetSelect');
    wsSelect.innerHTML = '<option value="" disabled selected>Select Worksheet</option>';
    dashboard.worksheets.forEach(ws => {
      const option = document.createElement('option');
      option.value = ws.name;
      option.text = ws.name;
      wsSelect.appendChild(option);
    });
  }
  
  async function populateColumnMapping() {
    const worksheetName = document.getElementById('worksheetSelect').value;
    const dashboard = tableau.extensions.dashboardContent.dashboard;
    const worksheet = dashboard.worksheets.find(ws => ws.name === worksheetName);
    
    if (!worksheet) return;
  
    const dataTable = await worksheet.getSummaryDataAsync({ maxRows: 100000, ignoreSelection: true });
    const columns = dataTable.columns.map(col => col.fieldName);
  
    const sourceSelect = document.getElementById('sourceSelect');
    const targetSelect = document.getElementById('targetSelect');
    const amountSelect = document.getElementById('amountSelect');
  
    sourceSelect.innerHTML = '<option value="" disabled selected>Select Source Column</option>';
    targetSelect.innerHTML = '<option value="" disabled selected>Select Target Column</option>';
    amountSelect.innerHTML = '<option value="" disabled selected>Select Amount Column</option>';
  
    columns.forEach(col => {
      sourceSelect.add(new Option(col, col));
      targetSelect.add(new Option(col, col));
      amountSelect.add(new Option(col, col));
    });

    // Add event listener to update color input labels when columns are selected
    sourceSelect.addEventListener('change', () => updateNodeColorLabels(dataTable));
    targetSelect.addEventListener('change', () => updateNodeColorLabels(dataTable));
  }
  
  function updateNodeColorLabels(dataTable) {
    const sourceCol = document.getElementById('sourceSelect').value;
    const targetCol = document.getElementById('targetSelect').value;

    if (!sourceCol || !targetCol) return;

    // Extract unique nodes from source and target columns
    const sourceIndex = dataTable.columns.findIndex(col => col.fieldName === sourceCol);
    const targetIndex = dataTable.columns.findIndex(col => col.fieldName === targetCol);

    const uniqueNodes = new Set(
        dataTable.data.flatMap(row => [
            row[sourceIndex].formattedValue, 
            row[targetIndex].formattedValue
        ])
    );

    const nodeArray = Array.from(uniqueNodes).slice(0, 4);

    // Create color input HTML with dynamic node labels
    const colorInputsHTML = nodeArray.map((nodeName, index) => `
        <div>
            <label for="node${index+1}Color">${nodeName} Color:</label>
            <input type="color" id="node${index+1}Color" value="${getDefaultColor(index)}">
        </div>
    `).join('');

    // Remove existing color inputs and add new ones
    const nodeColorSection = document.getElementById('nodeColorSection');
    if (nodeColorSection) {
        nodeColorSection.innerHTML = `
            <h3>Node Colors</h3>
            ${colorInputsHTML}
        `;
    }
  }
  
  function getDefaultColor(index) {
    const defaultColors = [
        '#777777', 
        '#00999F', 
        '#DDA60B', 
        '#924390'
    ];
    return defaultColors[index] || '#4682B4';
  }
  
  async function renderChart(config) {
    try {
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      const worksheet = dashboard.worksheets.find(ws => ws.name === config.worksheetName);
      if (!worksheet) {
        console.error("Worksheet not found for rendering chart.");
        return;
      }
  
      // Retrieve summary data from the worksheet.
      const dataTable = await worksheet.getSummaryDataAsync({ maxRows: 100000, ignoreSelection: true });
      const columns = dataTable.columns.map((col, index) => ({ fieldName: col.fieldName, index }));
  
      // Get the indices for the mapped columns.
      const sourceIndex = columns.find(col => col.fieldName === config.sourceCol)?.index;
      const targetIndex = columns.find(col => col.fieldName === config.targetCol)?.index;
      const amountIndex = columns.find(col => col.fieldName === config.amountCol)?.index;
      if (sourceIndex === undefined || targetIndex === undefined || amountIndex === undefined) {
        console.error("Column mapping error. Please verify your column selections.");
        return;
      }
  
      // Aggregate data into flows.
      const flows = {};
      dataTable.data.forEach(row => {
        const sourceVal = row[sourceIndex].formattedValue;
        const targetVal = row[targetIndex].formattedValue;
        const amount = parseFloat(row[amountIndex].value);
        if (isNaN(amount) || amount === 0) return;
        const key = sourceVal + '||' + targetVal;
        if (!flows[key]) {
          flows[key] = { source: sourceVal, target: targetVal, amount: 0 };
        }
        flows[key].amount += amount;
      });
  
      if (Object.keys(flows).length === 0) {
        console.error("No valid flows computed. Verify that your 'Amount' column contains valid numbers.");
        return;
      }
  
      // Create a unique mapping of nodes.
      const nodeMap = {};
      Object.values(flows).forEach(flow => {
        if (!(flow.source in nodeMap)) {
          nodeMap[flow.source] = Object.keys(nodeMap).length;
        }
        if (!(flow.target in nodeMap)) {
          nodeMap[flow.target] = Object.keys(nodeMap).length;
        }
      });
  
      // Build links array using node indices.
      const links = Object.values(flows).map(flow => ({
        source: nodeMap[flow.source],
        target: nodeMap[flow.target],
        value: flow.amount
      }));
  
      // Build nodes array.
      const nodes = Object.keys(nodeMap).map(label => ({ name: label }));
  
      // Prepare the graph for the Sankey layout.
      const graph = { nodes, links };
  
      // Update container sizing
      const container = document.getElementById('chart');
      container.style.width = '100%';
      container.style.height = '100%';
      container.innerHTML = "";
  
      // Get the actual dimensions from the container
      const width = container.clientWidth;
      const height = container.clientHeight;
  
      // Create an SVG element that fills the container
      const svg = d3.select(container)
        .append("svg")
        .attr("width", '100%')
        .attr("height", '100%')
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMinYMin");
  
      // Use d3.sankey instead of d3Sankey
      const sankeyGenerator = d3.sankey()
        .nodeWidth(20)
        .nodePadding(10)
        .extent([[1, 1], [width - 1, height - 1]]);
      const sankeyLinkHorizontal = d3.sankeyLinkHorizontal;
  
      // Compute the Sankey layout.
      const sankeyGraph = sankeyGenerator(graph);
  
      // Use default colors if not provided in config
      const defaultColors = [
          '#777777',
          '#00999F', 
          '#DDA60B', 
          '#924390'
      ];
      const nodeColors = config.nodeColors || defaultColors;
  
      // Draw nodes with custom colors
      const node = svg.append("g")
        .selectAll("g")
        .data(sankeyGraph.nodes)
        .enter().append("g");
  
      node.append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", (d, i) => nodeColors[i % nodeColors.length] || '#4682B4')
        .attr("stroke", "#000");
  
      // Draw links with node-specific colors and reduced opacity
      svg.append("g")
        .attr("fill", "none")
        .attr("stroke-opacity", 0.5)
        .selectAll("path")
        .data(sankeyGraph.links)
        .enter().append("path")
        .attr("d", sankeyLinkHorizontal())
        .attr("stroke", d => {
            // Use the color of the source node with 50% opacity
            const sourceColor = nodeColors[d.source.index % nodeColors.length] || '#4682B4';
            return sourceColor;
        })
        .attr("stroke-width", d => Math.max(1, d.width));
  
      // Add node labels.
      node.append("text")
        .attr("x", d => d.x0 - 6)
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .text(d => d.name)
        .filter(d => d.x0 < width / 2)
        .attr("x", d => d.x1 + 6)
        .attr("text-anchor", "start");
    } catch (error) {
      console.error("Error rendering chart:", error);
      document.getElementById('chart').innerHTML = `<p style="color: red;">Error rendering chart: ${error.message}</p>`;
    }
  }