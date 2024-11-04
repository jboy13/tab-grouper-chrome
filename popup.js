let useSubdomains = false;

async function updateStats() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  
  document.getElementById('tabCount').textContent = tabs.length;
  document.getElementById('groupCount').textContent = groups.length;

  // Display existing groups
  const resultDiv = document.getElementById('results');
  resultDiv.innerHTML = ''; // Clear previous results

  if (groups.length > 0) {
    const groupDetails = new Map();
    groups.forEach(group => {
      groupDetails.set(group.id, {
        title: group.title,
        color: group.color,
        tabs: []
      });
    });

    tabs.forEach(tab => {
      if (tab.groupId !== -1) {
        groupDetails.get(tab.groupId)?.tabs.push({
          title: tab.title,
          url: tab.url,
          favicon: tab.favIconUrl
        });
      }
    });

    let resultsHTML = '';
    groupDetails.forEach(group => {
      resultsHTML += `
        <div class="group">
          <div class="group-header">
            <div class="group-color-dot" style="background-color: ${group.color}"></div>
            <div class="group-title">${group.title}</div>
            <div class="group-count">${group.tabs.length} tabs</div>
          </div>
          <div class="page-list">
            ${group.tabs.map(tab => `
              <div class="page-item">
                <img class="page-favicon" src="${tab.favicon || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'}" alt="">
                ${tab.title}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    resultDiv.innerHTML = resultsHTML;
  } else {
    resultDiv.innerHTML = `
      <div class="empty-state">
        No groups created yet. Try opening more tabs from the same domains.
      </div>
    `;
  }
}

// Load saved preferences
chrome.storage.local.get(['useSubdomains'], (result) => {
  useSubdomains = result.useSubdomains || false;
  document.getElementById('groupingMode').checked = useSubdomains;
});

// Update stats when popup opens
updateStats();

// Handle toggle change
document.getElementById('groupingMode').addEventListener('change', (e) => {
  useSubdomains = e.target.checked;
  chrome.storage.local.set({ useSubdomains });
});

document.getElementById('groupButton').addEventListener('click', async () => {
  const resultDiv = document.getElementById('results');
  resultDiv.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <div>Organizing your tabs...</div>
    </div>
  `;
  
  try {
    await chrome.runtime.sendMessage({ 
      action: 'groupTabs',
      useSubdomains 
    });
    // Update stats after grouping
    await updateStats();
  } catch (error) {
    resultDiv.innerHTML = `
      <div class="empty-state" style="color: #dc3545;">
        Error grouping tabs: ${error.message}
      </div>
    `;
  }
});

document.getElementById('ungroupButton').addEventListener('click', async () => {
  const resultDiv = document.getElementById('results');
  resultDiv.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <div>Ungrouping your tabs...</div>
    </div>
  `;
  
  try {
    await chrome.runtime.sendMessage({ action: 'ungroupTabs' });
    // Update stats after ungrouping
    await updateStats();

    resultDiv.innerHTML = `
      <div class="empty-state">
        Tabs have been ungrouped.
      </div>
    `;
  } catch (error) {
    resultDiv.innerHTML = `
      <div class="empty-state" style="color: #dc3545;">
        Error ungrouping tabs: ${error.message}
      </div>
    `;
  }
});

function updateSavedConfigsList() {
  chrome.storage.local.get(['savedConfigs'], (result) => {
    const configs = result.savedConfigs || {};
    const configsContainer = document.getElementById('savedConfigs');
    configsContainer.innerHTML = '';

    for (const configName in configs) {
      const configItem = document.createElement('div');
      configItem.classList.add('config-item');
      configItem.innerHTML = `
        <div class="config-title">${configName}</div>
        <button class="load-button" data-config="${configName}">Load</button>
        <button class="delete-button" data-config="${configName}">Delete</button>
      `;
      configsContainer.appendChild(configItem);
    }

    // Attach event listeners to load and delete buttons
    document.querySelectorAll('.load-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const configName = e.target.getAttribute('data-config');
        chrome.runtime.sendMessage({ action: 'loadConfig', configName });
      });
    });

    document.querySelectorAll('.delete-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const configName = e.target.getAttribute('data-config');
        chrome.runtime.sendMessage({ action: 'deleteConfig', configName });
      });
    });
  });
}

// Save configuration on button click
document.getElementById('saveConfigButton').addEventListener('click', () => {
  const configName = prompt("Enter a name for this configuration:");
  if (configName) {
    chrome.runtime.sendMessage({ action: 'saveConfig', configName });
  }
});

// Listen for messages from background.js to update list
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'updateConfigsList') {
    updateSavedConfigsList();
  }
});

// Update the saved configurations list on popup load
document.addEventListener('DOMContentLoaded', updateSavedConfigsList);