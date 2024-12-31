const map = L.map('map').setView([20, 0], 2); // Default world view

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

let countries; // Store GeoJSON features globally

// Fetch and load GeoJSON
fetch('world-administrative-boundaries.geojson')
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('GeoJSON Data:', data); // Debug GeoJSON data
    countries = data.features;
    populateCountryDropdowns(); // Populate dropdowns after data is loaded
    renderAllBoundaries(); // Show boundaries on the map
  })
  .catch(err => console.error('Error loading GeoJSON:', err));

// Group countries and territories
function groupCountriesAndTerritories() {
  const groupedData = { independentTerritories: [] };

  countries.forEach(country => {
    const colorCode = country.properties.color_code || country.properties.iso3;
    const name = country.properties.name;
    const status = country.properties.status || '';
    const area = turf.area(country); // Calculate area using Turf.js

    if (!colorCode) {
      // Handle independent territories or unlinked features
      if (status.includes('Non-Self-Governing Territory') || status.includes('Occupied')) {
        groupedData.independentTerritories.push({ name, area });
      }
      return;
    }

    if (!groupedData[colorCode]) {
      groupedData[colorCode] = {
        parentName: status === 'Member State' ? name : colorCode,
        territories: [],
        area: 0 // Track total area for proportional weighting
      };
    }

    if (status.includes('Territory') || status.includes('Special Administrative Region')) {
      groupedData[colorCode].territories.push({ name, area });
    } else {
      groupedData[colorCode].parentName = name;
    }

    groupedData[colorCode].area += area; // Add area to total
  });

  console.log('Grouped Data:', groupedData); // Debug grouped data
  return groupedData;
}

// Render all boundaries on the map
function renderAllBoundaries() {
  L.geoJSON(countries, {
    style: { color: 'gray', weight: 1 },
  }).addTo(map);
}

// Populate country and territory dropdowns
function populateCountryDropdowns() {
  const groupedData = groupCountriesAndTerritories();

  const parentDropdown = document.getElementById('countryDropdown');
  const territoryContainer = document.getElementById('territoryContainer'); // Checkbox container

  // Check if DOM elements exist
  if (!parentDropdown || !territoryContainer) {
    console.error('Dropdown or territory container not found.');
    return;
  }

  // Populate parent country dropdown
  Object.values(groupedData)
    .filter(group => group.parentName) // Only include groups with a parentName
    .sort((a, b) => a.parentName.localeCompare(b.parentName))
    .forEach(group => {
      const option = document.createElement('option');
      option.value = group.parentName;
      option.textContent = `${group.parentName} (${group.territories.length})`; // Show territory count
      parentDropdown.appendChild(option);
    });

  // Add independent territories to the dropdown
  const independentTerritories = groupedData.independentTerritories.sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  if (independentTerritories.length > 0) {
    const independentGroup = document.createElement('optgroup');
    independentGroup.label = "Non-State Entities";

    independentTerritories.forEach(territory => {
      const option = document.createElement('option');
      option.value = territory.name;
      option.textContent = territory.name;
      independentGroup.appendChild(option);
    });

    parentDropdown.appendChild(independentGroup);
  }

  // Update territories when parent country is selected
  parentDropdown.addEventListener('change', () => {
    const selectedParent = parentDropdown.value;

    // Clear previous checkboxes
    territoryContainer.innerHTML = '';

    const group = Object.values(groupedData).find(g => g.parentName === selectedParent);

    if (group) {
      group.territories.forEach(territory => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = territory.name;
        checkbox.id = `checkbox-${territory.name}`;

        const label = document.createElement('label');
        label.htmlFor = `checkbox-${territory.name}`;
        label.textContent = territory.name;

        territoryContainer.appendChild(checkbox);
        territoryContainer.appendChild(label);
        territoryContainer.appendChild(document.createElement('br'));
      });
    }
  });
}

// Generate a random point with proportional weighting
function generateRandomSpot() {
  const parentCountry = document.getElementById('countryDropdown').value;
  const selectedTerritories = Array.from(
    document.querySelectorAll('#territoryContainer input:checked')
  ).map(checkbox => checkbox.value);

  const selectedFeatures = countries.filter(feature =>
    selectedTerritories.includes(feature.properties.name) ||
    feature.properties.name === parentCountry
  );

  if (selectedFeatures.length === 0) {
    alert('No valid regions selected.');
    return;
  }

  // Proportional random selection
  const totalArea = selectedFeatures.reduce((sum, feature) => sum + turf.area(feature), 0);
  let randomValue = Math.random() * totalArea;

  for (const feature of selectedFeatures) {
    const featureArea = turf.area(feature);
    if (randomValue <= featureArea) {
      // Generate random point within selected feature
      const bbox = turf.bbox(feature);
      let randomPoint;

      do {
        randomPoint = turf.randomPoint(1, { bbox }).features[0];
      } while (!turf.booleanPointInPolygon(randomPoint, feature));

      // Highlight the selected feature and add the random point
      map.eachLayer(layer => {
        if (!(layer instanceof L.TileLayer)) {
          map.removeLayer(layer);
        }
      });

      L.geoJSON(feature, { style: { color: 'blue', weight: 2 } }).addTo(map);

      const coords = randomPoint.geometry.coordinates;
      L.marker([coords[1], coords[0]])
        .addTo(map)
        .bindPopup(`Random Spot in ${feature.properties.name} at (${coords[1].toFixed(5)}, ${coords[0].toFixed(5)})`)
        .openPopup();

      map.fitBounds(L.geoJSON(feature).getBounds());
      return;
    }

    randomValue -= featureArea;
  }
}

// Attach the random spot generator to the button
document.getElementById('generate').addEventListener('click', generateRandomSpot);
