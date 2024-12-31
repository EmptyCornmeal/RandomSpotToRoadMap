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
    countries = data.features;
    populateCountryDropdowns(); // Populate dropdowns after data is loaded
  })
  .catch(err => console.error('Error loading GeoJSON:', err));


// Group countries and territories
function groupCountriesAndTerritories() {
  const groupedData = { independentTerritories: [] };

  countries.forEach(country => {
    const colorCode = country.properties.color_code || country.properties.iso3;
    const name = country.properties.name;
    const status = country.properties.status || '';

    if (!colorCode) {
      // Handle independent territories or unlinked features
      if (status.includes('Non-Self-Governing Territory') || status.includes('Occupied')) {
        groupedData.independentTerritories.push(name);
      }
      return;
    }

    if (!groupedData[colorCode]) {
      groupedData[colorCode] = {
        parentName: status === 'Member State' ? name : colorCode,
        territories: []
      };
    }

    if (status.includes('Territory') || status.includes('Special Administrative Region')) {
      groupedData[colorCode].territories.push(name);
    } else {
      groupedData[colorCode].parentName = name;
    }
  });

  return groupedData;
}

// Populate country and territory dropdowns
function populateCountryDropdowns() {
  const groupedData = groupCountriesAndTerritories();

  const parentDropdown = document.getElementById('countryDropdown');
  const territoryDropdown = document.getElementById('territoryDropdown');

  // Populate parent country dropdown
  Object.values(groupedData)
    .filter(group => group.territories.length === 0 || group.parentName) // Only independent countries
    .sort((a, b) => a.parentName.localeCompare(b.parentName))
    .forEach(group => {
      if (group.parentName) { // Add only parent countries
        const option = document.createElement('option');
        option.value = group.parentName;
        option.textContent = group.parentName;
        parentDropdown.appendChild(option);
      }
    });

  // Add an independent territories section to the territory dropdown
  const independentTerritories = groupedData.independentTerritories.sort();
  if (independentTerritories.length > 0) {
    const independentGroup = document.createElement('optgroup');
    independentGroup.label = "Independent Territories";

    independentTerritories.forEach(territory => {
      const option = document.createElement('option');
      option.value = territory;
      option.textContent = territory;
      independentGroup.appendChild(option);
    });

    territoryDropdown.appendChild(independentGroup);
  }

  // Update territories when parent country is selected
  parentDropdown.addEventListener('change', () => {
    const selectedParent = parentDropdown.value;

    if (selectedParent === 'world') {
      // Clear and disable territory dropdown for "All Countries"
      territoryDropdown.innerHTML = '<option value="">Select a Territory</option>';
      territoryDropdown.disabled = true;
      return;
    }

    const group = Object.values(groupedData).find(g => g.parentName === selectedParent);

    // Clear and populate territory dropdown
    territoryDropdown.innerHTML = '<option value="">Select a Territory</option>';
    group?.territories.sort().forEach(territory => {
      const option = document.createElement('option');
      option.value = territory;
      option.textContent = territory;
      territoryDropdown.appendChild(option);
    });

    territoryDropdown.disabled = false; // Enable dropdown
  });
}

// Generate a random point
function generateRandomSpot() {
  const parentCountry = document.getElementById('countryDropdown').value;
  const territory = document.getElementById('territoryDropdown').value;

  const selectedRegion = territory || parentCountry; // Use territory if selected, fallback to parent country
  if (selectedRegion === "world") {
    alert('Generating a random spot for the entire world!');
    // Generate a random spot for the world
    return;
  }

  const selectedFeature = countries.find(feature => feature.properties.name === selectedRegion);

  if (!selectedFeature) {
    alert('Region not found in GeoJSON.');
    return;
  }

  // Generate random point within the region
  const bbox = turf.bbox(selectedFeature);
  let randomPoint;

  do {
    randomPoint = turf.randomPoint(1, { bbox }).features[0];
  } while (!turf.booleanPointInPolygon(randomPoint, selectedFeature));

  // Clear existing markers and highlight the region
  map.eachLayer(layer => {
    if (!(layer instanceof L.TileLayer)) {
      map.removeLayer(layer);
    }
  });

  L.geoJSON(selectedFeature, { style: { color: 'blue', weight: 2 } }).addTo(map);

  // Add marker for the random point
  const coords = randomPoint.geometry.coordinates;
  L.marker([coords[1], coords[0]]).addTo(map)
    .bindPopup(`Random Spot in ${selectedRegion} at (${coords[1].toFixed(5)}, ${coords[0].toFixed(5)})`)
    .openPopup();

  map.fitBounds(L.geoJSON(selectedFeature).getBounds());
}

document.getElementById('generate').addEventListener('click', generateRandomSpot);
