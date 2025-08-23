// Here are the potential issues and debugging steps for your auto-add functionality:

// 1. SELECTOR ISSUES - Your current selectors might not match your HTML structure
// Current code:
const colorRadio = form.querySelector('input[type="radio"][name^="Color"]:checked');
const sizeRadio = form.querySelector('input[type="radio"][name^="Size"]:checked');

// Try these alternatives:
const colorRadio = form.querySelector('input[type="radio"][name*="color" i]:checked') || 
                   form.querySelector('input[type="radio"][name*="Color"]:checked') ||
                   form.querySelector('input[type="radio"][name="options[Color]"]:checked');

const sizeRadio = form.querySelector('input[type="radio"][name*="size" i]:checked') || 
                  form.querySelector('input[type="radio"][name*="Size"]:checked') ||
                  form.querySelector('input[type="radio"][name="options[Size]"]:checked');

// 2. VALUE COMPARISON ISSUES - Case sensitivity and whitespace
// Current code:
if (selectedColor === 'Black' && selectedSize === 'M') {

// Try case-insensitive comparison:
if (selectedColor?.toLowerCase().trim() === 'black' && selectedSize?.toLowerCase().trim() === 'm') {

// 3. DEBUGGING VERSION - Add console logs to see what's happening:

// Replace your current auto-add section with this debugging version:
console.log('=== AUTO-ADD DEBUG START ===');
console.log('Form:', form);

// Try multiple selector strategies
const colorSelectors = [
  'input[type="radio"][name^="Color"]:checked',
  'input[type="radio"][name*="color" i]:checked',
  'input[type="radio"][name*="Color"]:checked',
  'input[type="radio"][name="options[Color]"]:checked',
  'input[name*="color" i]:checked',
  'select[name*="color" i] option:checked'
];

const sizeSelectors = [
  'input[type="radio"][name^="Size"]:checked',
  'input[type="radio"][name*="size" i]:checked',
  'input[type="radio"][name*="Size"]:checked',
  'input[type="radio"][name="options[Size]"]:checked',
  'input[name*="size" i]:checked',
  'select[name*="size" i] option:checked'
];

let colorRadio = null;
let sizeRadio = null;

// Try each selector until we find one that works
for (const selector of colorSelectors) {
  colorRadio = form.querySelector(selector);
  if (colorRadio) {
    console.log(`Color found with selector: ${selector}`, colorRadio);
    break;
  }
}

for (const selector of sizeSelectors) {
  sizeRadio = form.querySelector(selector);
  if (sizeRadio) {
    console.log(`Size found with selector: ${selector}`, sizeRadio);
    break;
  }
}

const selectedColor = colorRadio ? colorRadio.value : '';
const selectedSize = sizeRadio ? sizeRadio.value : '';

console.log('Selected Color:', selectedColor);
console.log('Selected Size:', selectedSize);
console.log('Color element:', colorRadio);
console.log('Size element:', sizeRadio);

// Also check all form inputs to see the structure
console.log('All form inputs:');
Array.from(form.querySelectorAll('input, select')).forEach(input => {
  console.log(`${input.tagName} - name: "${input.name}", value: "${input.value}", type: "${input.type}", checked: ${input.checked}`);
});

const softWinterJacketVariantId = '42822036684878';

// Try both case-sensitive and case-insensitive comparisons
const exactMatch = selectedColor === 'Black' && selectedSize === 'M';
const caseInsensitiveMatch = selectedColor?.toLowerCase().trim() === 'black' && 
                            selectedSize?.toLowerCase().trim() === 'm';

console.log('Exact match (Black + M):', exactMatch);
console.log('Case-insensitive match:', caseInsensitiveMatch);

if (exactMatch || caseInsensitiveMatch) {
  console.log('✅ Conditions met! Adding Soft Winter Jacket...');
  
  const fd = new FormData();
  fd.append('id', softWinterJacketVariantId);
  fd.append('quantity', '1');
  
  console.log('FormData for auto-add:', {
    id: fd.get('id'),
    quantity: fd.get('quantity')
  });
  
  fetch(Theme.routes.cart_add_url, { 
    ...fetchCfg, 
    body: fd, 
    headers: { ...fetchCfg.headers, Accept: 'application/json' } 
  })
  .then(res => {
    console.log('Auto-add response status:', res.status);
    return res.json();
  })
  .then(res => {
    console.log('✅ Soft Winter Jacket auto-added successfully:', res);
  })
  .catch(err => {
    console.error('❌ Auto-add failed:', err);
  });
} else {
  console.log('❌ Conditions not met for auto-add');
}

console.log('=== AUTO-ADD DEBUG END ===');

// 4. ALTERNATIVE APPROACH - Listen for form changes instead
// You could also try listening for variant selection events:

// Add this to your connectedCallback in ProductFormComponent:
target?.addEventListener('change', (event) => {
  if (event.target.matches('input[type="radio"], select')) {
    setTimeout(() => {
      this.#checkAutoAdd();
    }, 100); // Small delay to ensure all form updates are complete
  }
}, { signal });

// Add this method to ProductFormComponent:
#checkAutoAdd() {
  const form = this.querySelector('form');
  if (!form) return;
  
  // Your auto-add logic here
  console.log('Checking auto-add conditions...');
  // ... rest of the auto-add code
}

// 5. SHOPIFY-SPECIFIC APPROACH
// If using Shopify's variant selector, you might need:
const variantId = this.refs.variantId.value;
const selectedVariant = window.productVariants?.find(v => v.id == variantId);

if (selectedVariant) {
  const hasBlackColor = selectedVariant.options.some(opt => 
    opt.toLowerCase().includes('black')
  );
  const hasMSize = selectedVariant.options.some(opt => 
    opt.toLowerCase().includes('m') && opt.length <= 2 // Avoid matching "Medium"
  );
  
  if (hasBlackColor && hasMSize) {
    // Add the jacket
  }
}