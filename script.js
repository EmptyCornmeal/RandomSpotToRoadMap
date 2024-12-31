const map = L.map('map').setView([20, 0], 2); // Default world view

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

let countries; // Store GeoJSON features globally

// Fetch and load GeoJSON
fetch('data/world-administrative-boundaries.geojson')
  .then(response => response.json())
  .then(data => {
    countries = data.features;
    populateCountryDropdowns(); // Populate the dropdowns after data is loaded
  })
  .catch(err => console.error('Error loading GeoJSON:', err));

// Group countries and territories
function groupCountriesAndTerritories() {
  const groupedData = {};

  countries.forEach(country => {
    const parentCode = country.properties.color_code || country.properties.iso3; // Parent country code
    const name = country.properties.name; // Country or territory name
    const status = country.properties.status || ''; // Status (e.g., "Member State", "Territory")

    if (!groupedData[parentCode]) {
      groupedData[parentCode] = {
        parentName: status === 'Member State' ? name : parentCode, // Use name if it's a member state
        territories: []
      };
    }

    if (status.includes('Territory')) {
      groupedData[parentCode].territories.push(name); // Add as a territory
    } else {
      groupedData[parentCode].parentName = name; // Update parent country name
    }
  });

  return groupedData;
}

// Populate dropdowns
function populateCountryDropdowns() {
  const groupedData = groupCountriesAndTerritories();

  const parentDropdown = document.getElementById('countryDropdown');
  const territoryDropdown = document.getElementById('territoryDropdown');

  // Populate parent country dropdown
  Object.values(groupedData)
    .sort((a, b) => a.parentName.localeCompare(b.parentName))
    .forEach(group => {
      const option = document.createElement('option');
      option.value = group.parentName;
      option.textContent = group.parentName;
      parentDropdown.appendChild(option);
    });

  // Update territories when parent country is selected
  parentDropdown.addEventListener('change', () => {
    const selectedParent = parentDropdown.value;
    const group = Object.values(groupedData).find(g => g.parentName === selectedParent);

    // Clear and populate territory dropdown
    territoryDropdown.innerHTML = '<option value="">Select a Territory</option>';
    group?.territories.sort().forEach(territory => {
      const option = document.createElement('option');
      option.value = territory;
      option.textContent = territory;
      territoryDropdown.appendChild(option);
    });
  });
}

// Generate a random point
function generateRandomSpot() {
  const parentCountry = document.getElementById('countryDropdown').value;
  const territory = document.getElementById('territoryDropdown').value;

  const selectedRegion = territory || parentCountry; // Use territory if selected, fallback to parent country
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
