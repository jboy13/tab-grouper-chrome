const AVAILABLE_COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
let usedColors = [];

function getDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '');
  } catch (e) {
    return '';
  }
}

function getBaseDomain(url) {
  const domain = getDomain(url);
  // Split by dots
  const parts = domain.split('.');
  
  // Check if there are enough parts for a valid grouping
  if (parts.length < 2) return parts[0];

  // Handle special cases for country-specific TLDs
  const knownTLDs = [
    'co.uk', 'co.jp', 'co.kr', 'co.nz', 'co.in', 'co.id', 'co.il', 
    'com.au', 'com.br', 'com.mx', 'com.hk', 'com.sg', 'com.tr',
    'org.uk', 'net.uk', 'gov.uk', 'ac.uk',
    'org.au', 'net.au', 'gov.au',
    'me.uk', 'ltd.uk', 'plc.uk'
  ];

  // Join the last parts to check against known TLDs
  const lastParts = parts.slice(-2).join('.');

  // If we have a known three-part TLD (e.g., co.uk)
  if (parts.length >= 3 && knownTLDs.includes(lastParts)) {
    return parts[parts.length - 3]; // Return the third last part
  }

  // Default case: return second last part
  return parts[parts.length - 2];
}

function getDomainForGrouping(url, useSubdomains) {
  const domain = getDomain(url);
  
  if (!useSubdomains) {
    return getBaseDomain(url);
  }
  
  // Split the domain into parts by dots
  const parts = domain.split('.');
  
  // If there are only two parts, there is no subdomain, so return the main part
  if (parts.length <= 2) {
    return parts[0];
  }
  
  // Handle special cases for known TLDs (e.g., ".co.uk", ".com.au")
  const knownTLDs = [
    'co.uk', 'co.jp', 'co.kr', 'co.nz', 'co.in', 'co.id', 'co.il', 
    'com.au', 'com.br', 'com.mx', 'com.hk', 'com.sg', 'com.tr',
    'org.uk', 'net.uk', 'gov.uk', 'ac.uk',
    'org.au', 'net.au', 'gov.au',
    'me.uk', 'ltd.uk', 'plc.uk'
  ];
  
  // Check if the last two parts match a known TLD
  const lastParts = parts.slice(-2).join('.');
  if (knownTLDs.includes(lastParts)) {
    // If a known TLD, consider the segment just before it as the base domain
    return parts.slice(0, -3).join('.') || parts[0];
  }
  
  // Default case: return the first subdomain part (e.g., "console" from "console.cloud.google.com")
  return parts[0];
}


function getColorForDomain(domain) {
  let color;
  if (usedColors.length === AVAILABLE_COLORS.length) {
    usedColors = [];
  }
  
  do {
    const randomIndex = Math.floor(Math.random() * AVAILABLE_COLORS.length);
    color = AVAILABLE_COLORS[randomIndex];
  } while (usedColors.includes(color));
  
  usedColors.push(color);
  return color;
}

async function groupTabs(useSubdomains = false) {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const domainMap = new Map();
    
    tabs.forEach(tab => {
      const groupKey = getDomainForGrouping(tab.url, useSubdomains);
      if (!domainMap.has(groupKey)) {
        domainMap.set(groupKey, []);
      }
      domainMap.get(groupKey).push(tab.id);
    });
    
    const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    
    for (const [domain, tabIds] of domainMap) {
      if (tabIds.length > 0) {
        const existingGroup = groups.find(group => group.title?.toLowerCase() === domain.toLowerCase());
        
        if (existingGroup) {
          await chrome.tabs.group({
            groupId: existingGroup.id,
            tabIds: tabIds
          });
        } else {
          const groupId = await chrome.tabs.group({ tabIds });
          await chrome.tabGroups.update(groupId, {
            title: domain,
            color: getColorForDomain(domain)
          });
        }
      }
    }
    return true;
  } catch (error) {
    console.error('Error grouping tabs:', error);
    throw error;
  }
}

async function ungroupTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });

    for (const tab of tabs) {
      if (tab.groupId !== -1) {
        await chrome.tabs.ungroup(tab.id); // Ungroup each tab
      }
    }

    return true;
  } catch (error) {
    console.error('Error ungrouping tabs:', error);
    throw error;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'groupTabs') {
    groupTabs(request.useSubdomains).then(() => sendResponse(true)).catch((error) => sendResponse(false));
    return true; // Will respond asynchronously
  } else if (request.action === 'ungroupTabs') {
    ungroupTabs().then(() => sendResponse(true)).catch((error) => sendResponse(false));
    return true; // Will respond asynchronously
  }
});