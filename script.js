document.addEventListener('DOMContentLoaded', () => {
    tableau.extensions.initializeAsync().then(() => {
      // If configuration was saved, use it; otherwise, show the config UI.
      const configStr = tableau.extensions.settings.get("sankeyConfig");
      if (configStr) {
        const config = JSON.parse(configStr);
        document.getElementById('configSection').classList.add('hidden');
        renderChart(config);
      } else {
        showConfigUI();
      }
    }).catch(err => {
      console.error("Error initializing extension:", err);
    });
  
    // Redraw the chart on window resize
    window.addEventListener('resize', () => {
      const configStr = tableau.extensions.settings.get("sankeyConfig");
      if (configStr) {
        const config = JSON.parse(configStr);
        renderChart(config);
      }
    });
  });
  
  function showConfigUI() {
    populateWorksheetDropdown();
  
    // When the worksheet changes, populate the column mapping dropdowns
    document.getElementById('worksheetSelect').addEventListener('change', async (e) => {
      const worksheetName = e.target.value;
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      const worksheet = dashboard.worksheets.find(ws => ws.name === worksheetName);
      if (!worksheet) return;
  
      // Retrieve one row of summary data to get column names
      const dataTable = await worksheet.getSummaryDataAsync({ maxRows: 1, ignoreSelection: true });
      const columns = dataTable.columns.map(col => col.fieldName);
  
      // Populate each dropdown
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
  
      // Show the column mapping section
      document.getElementById('columnMapping').classList.remove('hidden');
    });
  
    // Save configuration button handler
    document.getElementById('saveConfigBtn').addEventListener('click', () => {
      const worksheetName = document.getElementById('worksheetSelect').value;
      const sourceCol = document.getElementById('sourceSelect').value;
      const targetCol = document.getElementById('targetSelect').value;
      const amountCol = document.getElementById('amountSelect').value;
  
      if (!worksheetName || !sourceCol || !targetCol || !amountCol) {
        alert("Please select a worksheet and map all columns.");
        return;
      }
  
      const config = { worksheetName, sourceCol, targetCol, amountCol };
      tableau.extensions.settings.set("sankeyConfig", JSON.stringify(config));
      tableau.extensions.settings.saveAsync().then(() => {
        document.getElementById('configSection').classList.add('hidden');
        renderChart(config);
      });
    });
  }
  
  function populateWorksheetDropdown() {
    const dashboard = tableau.extensions.dashboardContent.dashboard;
    const worksheetSelect = document.getElementById('worksheetSelect');
    worksheetSelect.innerHTML = '<option value="" disabled selected>Select Worksheet</option>';
    dashboard.worksheets.forEach(ws => {
      const option = document.createElement('option');
      option.value = ws.name;
      option.text = ws.name;
      worksheetSelect.appendChild(option);
    });
  }
  
  async function renderChart(config) {
    const dashboard = tableau.extensions.dashboardContent.dashboard;
    const worksheet = dashboard.worksheets.find(ws => ws.name === config.worksheetName);
    if (!worksheet) {
      console.error("Worksheet not found for rendering chart.");
      return;
    }
  
    // Retrieve summary data from the worksheet
    const dataTable = await worksheet.getSummaryDataAsync({ maxRows: 100000, ignoreSelection: true });
    const columns = dataTable.columns.map((col, index) => ({ fieldName: col.fieldName, index }));
  
    // Get indices for the mapped columns
    const sourceIndex = columns.find(col => col.fieldName === config.sourceCol)?.index;
    const targetIndex = columns.find(col => col.fieldName === config.targetCol)?.index;
    const amountIndex = columns.find(col => col.fieldName === config.amountCol)?.index;
    if (sourceIndex === undefined || targetIndex === undefined || amountIndex === undefined) {
      console.error("Column mapping error.");
      return;
    }
  
    // Process data to aggregate flows
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
  
    // Create a unique list of nodes
    const nodeMap = {};
    Object.values(flows).forEach(flow => {
      if (!(flow.source in nodeMap)) {
        nodeMap[flow.source] = Object.keys(nodeMap).length;
      }
      if (!(flow.target in nodeMap)) {
        nodeMap[flow.target] = Object.keys(nodeMap).length;
      }
    });
  
    // Build links array using node indices
    const links = Object.values(flows).map(flow => ({
      source: nodeMap[flow.source],
      target: nodeMap[flow.target],
      value: flow.amount
    }));
  
    // Build nodes array
    const nodes = Object.keys(nodeMap).map(label => ({ name: label }));
  
    // Prepare the graph for the Sankey layout
    const graph = { nodes, links };
  
    // Clear any existing chart content
    const container = document.getElementById('chart');
    container.innerHTML = "";
  
    // Determine dimensions (minimum width 600, minimum height 400)
    const width = Math.max(container.clientWidth, 600);
    const height = Math.max(container.clientHeight, 400);
  
    // Create an SVG element
    const svg = d3.select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height);
  
    // Set up the d3-sankey generator
    const { sankey, sankeyLinkHorizontal } = d3.sankey;
    const sankeyGenerator = sankey()
      .nodeWidth(20)
      .nodePadding(10)
      .extent([[1, 1], [width - 1, height - 1]]);
  
    const sankeyGraph = sankeyGenerator(graph);
  
    // Draw links
    svg.append("g")
      .attr("fill", "none")
      .attr("stroke", "#000")
      .attr("stroke-opacity", 0.2)
      .selectAll("path")
      .data(sankeyGraph.links)
      .enter().append("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke-width", d => Math.max(1, d.width));
  
    // Draw nodes
    const node = svg.append("g")
      .selectAll("g")
      .data(sankeyGraph.nodes)
      .enter().append("g");
  
    node.append("rect")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0)
      .attr("height", d => d.y1 - d.y0)
      .attr("width", d => d.x1 - d.x0)
      .attr("fill", "#4682B4")
      .attr("stroke", "#000");
  
    // Add node labels
    node.append("text")
      .attr("x", d => d.x0 - 6)
      .attr("y", d => (d.y0 + d.y1) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .text(d => d.name)
      .filter(d => d.x0 < width / 2)
      .attr("x", d => d.x1 + 6)
      .attr("text-anchor", "start");
  }