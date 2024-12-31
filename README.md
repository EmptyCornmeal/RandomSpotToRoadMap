# Random Spot in Selected Country

This branch introduces functionality for selecting a country from a dropdown menu and generating a random spot within that country's boundaries. The selected point is displayed on a map, along with the country's highlighted boundary.

## Features
- Dropdown menu to select a country from GeoJSON data.
- Random spot generation within the selected country's polygon or multipolygon.
- Integration with Leaflet.js for map visualization.
- Uses Turf.js for spatial operations like point validation.

## How to Use
1. Open the project in a browser.
2. Select a country from the dropdown menu.
3. Click "Generate Random Spot" to display a random location within the selected country's boundary.

## Dependencies
- [Leaflet.js](https://leafletjs.com/) for map rendering.
- [Turf.js](https://turfjs.org/) for geospatial calculations.
- GeoJSON data for administrative boundaries.

## Future Enhancements
- Add more UI elements for better interactivity.
- Option to export the generated point's coordinates.
