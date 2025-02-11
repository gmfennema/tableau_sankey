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
        // Get the selected worksheet name
        const worksheetName = document.getElementById('worksheetSelect').value;
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
    
    // Save the configuration using Tableau's settings API
    const config = { worksheetName, sourceCol, targetCol, amountCol };
    tableau.extensions.settings.set("sankeyConfig", JSON.stringify(config));
    await tableau.extensions.settings.saveAsync();
    
    // Hide the configuration UI and render the chart
    document.getElementById('configSection').classList.add('hidden');
    renderChart(config);
}

async function renderChart(config) {
    try {
        // Using the saved configuration, locate the worksheet
        const dashboard = tableau.extensions.dashboardContent.dashboard;
        const worksheet = dashboard.worksheets.find(ws => ws.name === config.worksheetName);
        if (!worksheet) {
            console.error("Worksheet not found for rendering chart.");
            return;
        }
        
        // Retrieve all summary data from the worksheet
        const options = { maxRows: 1000000, ignoreSelection: true };
        const dataTable = await worksheet.getSummaryDataAsync(options);
        
        // Find the indices for the mapped columns
        const columns = dataTable.columns.map((col, index) => ({ fieldName: col.fieldName, index }));
        const sourceIndex = columns.find(col => col.fieldName === config.sourceCol)?.index;
        const targetIndex = columns.find(col => col.fieldName === config.targetCol)?.index;
        const amountIndex = columns.find(col => col.fieldName === config.amountCol)?.index;
        
        if (sourceIndex === undefined || targetIndex === undefined || amountIndex === undefined) {
            console.error("One or more selected columns not found in data.");
            return;
        }
        
        // Process the data to aggregate flows for the Sankey diagram
        let flows = {};
        dataTable.data.forEach(row => {
            const sourceValue = row[sourceIndex].formattedValue;
            const targetValue = row[targetIndex].formattedValue;
            // Use the raw value for amount (assumed numeric)
            const amountValue = parseFloat(row[amountIndex].value);
            if (isNaN(amountValue)) return; // skip rows where amount is not a number
            
            const key = sourceValue + '||' + targetValue;
            if (!flows[key]) {
                flows[key] = { source: sourceValue, target: targetValue, amount: 0 };
            }
            flows[key].amount += amountValue;
        });
        
        // Build the list of unique nodes
        let nodes = {};
        Object.values(flows).forEach(flow => {
            if (!(flow.source in nodes)) {
                nodes[flow.source] = Object.keys(nodes).length;
            }
            if (!(flow.target in nodes)) {
                nodes[flow.target] = Object.keys(nodes).length;
            }
        });
        
        // Build the links array for Plotly
        let links = [];
        Object.values(flows).forEach(flow => {
            links.push({
                source: nodes[flow.source],
                target: nodes[flow.target],
                value: flow.amount
            });
        });
        
        // Create an array of node labels
        const nodeLabels = Object.keys(nodes);
        
        // Configure the Plotly Sankey diagram data
        const data = [{
            type: "sankey",
            orientation: "h",
            node: {
                pad: 15,
                thickness: 20,
                line: {
                    color: "black",
                    width: 0.5
                },
                label: nodeLabels,
                color: "blue"  // basic color for version 1
            },
            link: {
                source: links.map(link => link.source),
                target: links.map(link => link.target),
                value: links.map(link => link.value)
            }
        }];
        
        const layout = {
            title: "Sankey Diagram",
            font: {
                size: 10
            },
            width: 600,
            height: 400
        };
        
        // Render the chart into the 'chart' div
        Plotly.newPlot('chart', data, layout);
        
    } catch (error) {
        console.error("Error rendering Sankey chart:", error);
    }
}