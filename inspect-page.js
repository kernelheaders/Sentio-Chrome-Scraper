// Page inspection script - run this in console on a detail page
console.log('🔍 DETAIL PAGE INSPECTION');
console.log('URL:', window.location.href);
console.log('Title:', document.title);

// Check for contact elements
console.log('\n👤 NAME ELEMENTS:');
const nameSelectors = ['.user-info-agent h3', '.user-info h3', '.owner-info h3', '.contact-name', 'h3'];
nameSelectors.forEach(selector => {
  const element = document.querySelector(selector);
  console.log(`${selector}: ${element ? element.textContent?.trim() : 'NOT FOUND'}`);
});

console.log('\n📞 PHONE SECTION:');
const phoneSection = document.querySelector('.user-info-phones');
console.log('Phone section exists:', !!phoneSection);
if (phoneSection) {
  console.log('Phone section HTML:', phoneSection.innerHTML.substring(0, 500) + '...');
  const phoneItems = phoneSection.querySelectorAll('*');
  console.log('Phone section elements:', phoneItems.length);
  phoneItems.forEach((el, idx) => {
    if (el.textContent?.trim() && el.children.length === 0) {
      console.log(`  ${idx}: ${el.tagName} - "${el.textContent.trim()}"`);
    }
  });
} else {
  // Look for alternative phone patterns
  const phoneSelectors = ['.contact-phone', '.phone-number', '.telefon', '[class*="phone"]', '[class*="telefon"]'];
  console.log('Alternative phone elements:');
  phoneSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`${selector}: ${elements.length} found`);
    elements.forEach(el => console.log(`  - ${el.textContent?.trim()}`));
  });
}

console.log('\n🏢 COMPANY ELEMENTS:');
const companySelectors = ['.user-info-store-name a', '.user-info-store-name', '.company-name', '.store-name', '[class*="store"]'];
companySelectors.forEach(selector => {
  const element = document.querySelector(selector);
  console.log(`${selector}: ${element ? element.textContent?.trim() : 'NOT FOUND'}`);
});

console.log('\n📍 ADDRESS ELEMENTS:');
const addressSelectors = ['.breadcrumb a', '.location', '.address', '[class*="location"]', '[class*="address"]'];
addressSelectors.forEach(selector => {
  const elements = document.querySelectorAll(selector);
  console.log(`${selector}: ${elements.length} found`);
  elements.forEach(el => {
    const text = el.textContent?.trim();
    if (text && text.length < 100) {
      console.log(`  - ${text}`);
    }
  });
});

// Check all potential phone numbers on page
console.log('\n📱 ALL PHONE PATTERNS ON PAGE:');
const phoneRegex = /0\s*\(\s*\d{3}\s*\)\s*\d{3}\s*\d{2}\s*\d{2}/g;
const allText = document.body.textContent;
const foundPhones = allText.match(phoneRegex);
if (foundPhones) {
  foundPhones.forEach(phone => console.log(`  Found: ${phone}`));
} else {
  console.log('  No phone patterns found');
}

console.log('\n✅ Inspection complete - check results above');