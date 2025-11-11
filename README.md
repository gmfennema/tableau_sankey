# Tableau Sankey Chart Extension

A Tableau dashboard extension that creates interactive Sankey diagrams to visualize flow relationships between nodes.

## Quick Start

### Prerequisites

- Tableau Desktop or Tableau Server (with Extensions API support)
- A Tableau workbook with data formatted for Sankey visualization

### Data Format

Your Tableau worksheet must contain at least three columns:

1. **Source** - The origin node (e.g., starting point, category, or entity)
2. **Target** - The destination node (e.g., end point, category, or entity)
3. **Amount** - The flow value between source and target (must be numeric)

#### Sample Data Table

| Source | Target | Amount |
|--------|-------|--------|
| Marketing | Website | 1500 |
| Marketing | Email | 800 |
| Website | Purchase | 1200 |
| Website | Abandoned | 300 |
| Email | Purchase | 600 |
| Email | Unsubscribed | 200 |
| Purchase | Revenue | 1800 |

**Notes:**
- Each row represents a flow from Source to Target
- The Amount column should contain numeric values
- Source and Target can be any text values (they will appear as nodes in the diagram)
- Multiple rows with the same Source → Target combination will be automatically aggregated

### Installation

1. Download or clone this repository
2. Host the files on a web server (or use GitHub Pages)
3. Update the `source-location` URL in `sankey.trex` to point to your hosted location
4. In Tableau Desktop:
   - Go to **Dashboard** → **Extensions** → **Add Extension**
   - Select **My Extensions** → **Browse**
   - Choose the `sankey.trex` manifest file

### Usage

1. **Add the Extension to Your Dashboard**
   - Drag the Sankey Chart extension object onto your dashboard
   - Resize as needed

2. **Configure the Extension**
   - Select the worksheet containing your Source/Target/Amount data
   - Map your columns:
     - Choose the **Source** column
     - Choose the **Target** column
     - Choose the **Amount** column
   - Optionally customize node colors
   - Click **Save Configuration**

3. **Interact with the Chart**
   - The Sankey diagram will automatically update when filters or parameters change
   - Nodes display their total flow values
   - Link thickness represents the flow amount

### Features

- ✅ Automatic aggregation of flows
- ✅ Dynamic updates based on Tableau filters and parameters
- ✅ Customizable node colors
- ✅ Responsive layout that adapts to container size
- ✅ Node labels include total flow values

### Troubleshooting

- **No data showing**: Ensure your worksheet has data and all three columns are properly mapped
- **Extension not loading**: Verify the `source-location` URL in `sankey.trex` is accessible
- **Chart not updating**: Check that filters/parameters are applied to the selected worksheet

