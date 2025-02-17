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

    // Event listener to update column mapping dropdowns when a new worksheet is selected
    document.getElementById('worksheetSelect').addEventListener('change', async function (e) {
        const worksheetName = e.target.value;
        console.log("Worksheet selected:", worksheetName);
        
        const dashboard = tableau.extensions.dashboardContent.dashboard;
        const worksheet = dashboard.worksheets.find(ws => ws.name === worksheetName);
        if (!worksheet) {
            console.error("Worksheet not found for:", worksheetName);
            return;
        }
        
        try {
            // Retrieve a single row of summary data to extract column information
            const dataTable = await worksheet.getSummaryDataAsync({ maxRows: 1 });
            console.log("Summary data:", dataTable);
            
            const columns = dataTable.columns;
            console.log("Available columns:", columns.map(col => col.fieldName));
            
            // Grab the dropdown elements for column mapping
            const sourceSelect = document.getElementById('sourceSelect');
            const targetSelect = document.getElementById('targetSelect');
            const amountSelect = document.getElementById('amountSelect');
            
            // Clear any existing options and add a prompt option
            sourceSelect.innerHTML = '<option value="" disabled selected>Select Source Column</option>';
            targetSelect.innerHTML = '<option value="" disabled selected>Select Target Column</option>';
            amountSelect.innerHTML = '<option value="" disabled selected>Select Amount Column</option>';
            
            // Populate each dropdown with the available columns
            columns.forEach(col => {
                const optSource = document.createElement('option');
                optSource.value = col.fieldName;
                optSource.text = col.fieldName;
                
                const optTarget = document.createElement('option');
                optTarget.value = col.fieldName;
                optTarget.text = col.fieldName;
                
                const optAmount = document.createElement('option');
                optAmount.value = col.fieldName;
                optAmount.text = col.fieldName;
                
                sourceSelect.appendChild(optSource);
                targetSelect.appendChild(optTarget);
                amountSelect.appendChild(optAmount);
            });
            
            // Ensure the column mapping section is visible
            document.getElementById('columnMapping').classList.remove('hidden');
        } catch (error) {
            console.error("Error fetching column data:", error);
        }
    });
    
    // When source or target column selections change, update the node color pickers
    document.getElementById('sourceSelect').addEventListener('change', updateNodeColorsMapping);
    document.getElementById('targetSelect').addEventListener('change', updateNodeColorsMapping);
    
    // Save configuration when the button is clicked
    document.getElementById('saveConfigBtn').addEventListener('click', async function() {
        // Retrieve the worksheet selection and column mappings
        const worksheetSelect = document.getElementById("worksheetSelect");
        const sourceSelect = document.getElementById("sourceSelect");
        const targetSelect = document.getElementById("targetSelect");
        const amountSelect = document.getElementById("amountSelect");

        const worksheetName = worksheetSelect.value;
        const sourceCol = sourceSelect.value;
        const targetCol = targetSelect.value;
        const amountCol = amountSelect.value;

        // Basic validation to ensure all selections are made
        if (!worksheetName || !sourceCol || !targetCol || !amountCol) {
            console.error("Please make sure you have selected a worksheet and all three column values.");
            return;
        }

        // Build the configuration object (extend with more properties if needed)
        const config = {
            worksheetName: worksheetName,
            sourceCol: sourceCol,
            targetCol: targetCol,
            amountCol: amountCol,
            // If your node color configuration is used, include it here.
            // nodeColors: { ... }
        };

        // (Optional) Persist this configuration as needed with Tableau settings

        // Optionally, hide or disable the configuration UI
        document.getElementById("configSection").classList.add("hidden");

        // Render the chart using the newly built configuration
        await renderChart(config);
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
        
        // Build columns map and indices for source, target, and amount
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
        
        // Create a unique mapping of nodes
        let nodeMap = {};
        Object.values(flows).forEach(flow => {
            if (!(flow.source in nodeMap)) {
                nodeMap[flow.source] = Object.keys(nodeMap).length;
            }
            if (!(flow.target in nodeMap)) {
                nodeMap[flow.target] = Object.keys(nodeMap).length;
            }
        });
        
        // Build links array referring to node indices
        let links = [];
        Object.values(flows).forEach(flow => {
            links.push({
                source: nodeMap[flow.source],
                target: nodeMap[flow.target],
                value: flow.amount
            });
        });
        
        // Compute node totals (choose the max of in-flow or out-flow)
        const nodeLabels = Object.keys(nodeMap);
        let inFlow = new Array(nodeLabels.length).fill(0);
        let outFlow = new Array(nodeLabels.length).fill(0);
        links.forEach(link => {
            outFlow[link.source] += link.value;
            inFlow[link.target] += link.value;
        });
        const nodeTotals = nodeLabels.map((label, i) => Math.max(inFlow[i], outFlow[i]));
        const nodeLabelsWithTotals = nodeLabels.map((label, i) => `${label} (${nodeTotals[i]})`);
        
        // Create node colors using the configuration (default fallback to blue)
        const nodeColorsArr = nodeLabels.map(label => {
            return (config.nodeColors && config.nodeColors[label]) ? config.nodeColors[label] : "#0000FF";
        });
        
        // Prepare nodes array for d3-sankey
        const sankeyNodes = nodeLabelsWithTotals.map((name, i) => ({
            name: name,
            color: nodeColorsArr[i]
        }));
        
        // Prepare the graph object for d3-sankey
        const graph = {
            nodes: sankeyNodes,
            links: links
        };
        
        // Clear any existing chart content
        const container = document.getElementById('chart');
        container.innerHTML = "";
        
        // Set up dimensions (using the container's size)
        const width = container.clientWidth;
        const height = container.clientHeight || 600; // fallback height
        
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
            .extent([[1, 1], [width - 1, height - 6]]);
        
        // Compute the Sankey layout
        const sankeyGraph = sankeyGenerator(graph);
        
        // Define SVG defs for gradients
        const defs = svg.append("defs");
        sankeyGraph.links.forEach((d, i) => {
            let gradientId = "gradient" + i;
            let lg = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("gradientUnits", "userSpaceOnUse")
                .attr("x1", d.source.x1)
                .attr("y1", (d.y0 + d.y1) / 2)
                .attr("x2", d.target.x0)
                .attr("y2", (d.y0 + d.y1) / 2);
            lg.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d.source.color);
            lg.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d.target.color);
            d.gradientId = gradientId;
        });
        
        // Draw links (paths) with gradient strokes
        svg.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.5)
            .selectAll("path")
            .data(sankeyGraph.links)
            .enter().append("path")
            .attr("d", sankeyLinkHorizontal())
            .attr("stroke", d => `url(#${d.gradientId})`)
            .attr("stroke-width", d => Math.max(1, d.width));
        
        // Draw nodes (rectangles)
        const node = svg.append("g")
            .selectAll("g")
            .data(sankeyGraph.nodes)
            .enter().append("g");
        
        node.append("rect")
            .attr("x", d => d.x0)
            .attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0)
            .attr("width", d => d.x1 - d.x0)
            .attr("fill", d => d.color)
            .attr("stroke", "#000");
        
        // Add labels to nodes
        node.append("text")
            .attr("x", d => d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .text(d => d.name)
            .filter(d => d.x0 < width / 2)
            .attr("x", d => d.x1 + 6)
            .attr("text-anchor", "start");
        
        // Hide the extension title once the chart is displayed
        const extensionTitle = document.querySelector('h2');
        if (extensionTitle) {
            extensionTitle.style.display = 'none';
        }
    } catch (error) {
        console.error("Error rendering Sankey chart with D3:", error);
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