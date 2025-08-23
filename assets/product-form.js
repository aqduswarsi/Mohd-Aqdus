// Add this debugging code to your ProductFormComponent's handleSubmit method
// Place this RIGHT AT THE BEGINNING of handleSubmit, before any other logic:

console.log('🚀 === FORM SUBMISSION DEBUG START ===');

// 1. Check what variant is actually selected
const variantIdInput = this.refs.variantId;
console.log('🔗 Variant ID input element:', variantIdInput);
console.log('🔗 Current variant ID value:', variantIdInput?.value);

// 2. Check all form data being submitted
const form = this.querySelector('form');
const formData = new FormData(form);

console.log('📋 ALL FORM DATA BEING SUBMITTED:');
for (let [key, value] of formData.entries()) {
  console.log(`  ${key}: "${value}"`);
}

// 3. Check the actual HTML structure of your variant selectors
console.log('🎨 COLOR SELECTORS:');
const colorInputs = form.querySelectorAll('input[name*="color" i], input[name*="Color"], select[name*="color" i], select[name*="Color"]');
colorInputs.forEach((input, i) => {
  const isSelected = input.type === 'radio' ? input.checked : input.selected;
  console.log(`  ${i}: ${input.tagName} name="${input.name}" value="${input.value}" selected/checked=${isSelected}`);
});

console.log('📏 SIZE SELECTORS:');
const sizeInputs = form.querySelectorAll('input[name*="size" i], input[name*="Size"], select[name*="size" i], select[name*="Size"]');
sizeInputs.forEach((input, i) => {
  const isSelected = input.type === 'radio' ? input.checked : input.selected;
  console.log(`  ${i}: ${input.tagName} name="${input.name}" value="${input.value}" selected/checked=${isSelected}`);
});

// 4. Check if there are any hidden inputs controlling the variant
console.log('🔍 HIDDEN INPUTS:');
const hiddenInputs = form.querySelectorAll('input[type="hidden"]');
hiddenInputs.forEach((input, i) => {
  console.log(`  ${i}: name="${input.name}" value="${input.value}"`);
});

// 5. Check if using Shopify's variant selection system
console.log('🛍️ SHOPIFY VARIANT DATA:');
if (window.product) {
  console.log('Product data available:', !!window.product);
  console.log('Product variants:', window.product.variants?.length || 'none');
  
  const selectedVariantId = variantIdInput?.value;
  if (selectedVariantId && window.product.variants) {
    const selectedVariant = window.product.variants.find(v => v.id == selectedVariantId);
    console.log('Selected variant object:', selectedVariant);
    if (selectedVariant) {
      console.log('Selected variant options:', selectedVariant.options);
      console.log('Selected variant title:', selectedVariant.title);
    }
  }
}

// 6. Check for option selectors (Shopify standard)
console.log('⚙️ OPTION SELECTORS:');
const optionSelectors = form.querySelectorAll('select[name^="options["], input[name^="options["]');
optionSelectors.forEach((selector, i) => {
  const value = selector.type === 'radio' ? (selector.checked ? selector.value : 'not selected') : selector.value;
  console.log(`  ${i}: ${selector.tagName} name="${selector.name}" value="${value}"`);
});

// 7. Listen for variant changes to see what's happening
console.log('👂 SETTING UP VARIANT CHANGE LISTENERS...');

// Listen for any change events on the form
form.addEventListener('change', (e) => {
  console.log('📝 Form changed:', e.target.name, '=', e.target.value);
  
  // Re-check variant ID after changes
  setTimeout(() => {
    console.log('🔄 Variant ID after change:', variantIdInput?.value);
    
    // Check if variant data changed
    if (window.product && window.product.variants) {
      const currentVariant = window.product.variants.find(v => v.id == variantIdInput?.value);
      if (currentVariant) {
        console.log('🔄 Current variant after change:', currentVariant.title, currentVariant.options);
      }
    }
  }, 100);
});

console.log('🚀 === FORM SUBMISSION DEBUG END ===');

// Now continue with your original handleSubmit logic...

// ALSO: Add this enhanced version of your auto-add logic:
// Replace your current auto-add section with this:

console.log('🎯 === AUTO-ADD LOGIC START ===');

// Method 1: Try to get size/color from variant data (most reliable for Shopify)
let selectedColor = '';
let selectedSize = '';

const currentVariantId = variantIdInput?.value;
if (currentVariantId && window.product?.variants) {
  const currentVariant = window.product.variants.find(v => v.id == currentVariantId);
  if (currentVariant && currentVariant.options) {
    console.log('🔍 Using variant data for color/size detection');
    console.log('Variant options array:', currentVariant.options);
    
    // Shopify typically stores options in order: [Color, Size] or [Size, Color]
    // We need to figure out which is which by looking at option names
    if (window.product.options) {
      console.log('Product option names:', window.product.options);
      
      window.product.options.forEach((optionName, index) => {
        const optionValue = currentVariant.options[index];
        console.log(`Option ${index}: ${optionName} = ${optionValue}`);
        
        if (optionName.toLowerCase().includes('color') || optionName.toLowerCase().includes('colour')) {
          selectedColor = optionValue;
        }
        if (optionName.toLowerCase().includes('size')) {
          selectedSize = optionValue;
        }
      });
    } else {
      // Fallback: assume first option is color, second is size (common Shopify pattern)
      selectedColor = currentVariant.options[0] || '';
      selectedSize = currentVariant.options[1] || '';
    }
  }
}

// Method 2: Fallback to form inputs if variant method didn't work
if (!selectedColor || !selectedSize) {
  console.log('🔄 Falling back to form input detection');
  
  // Get from form data
  for (let [key, value] of formData.entries()) {
    console.log(`Checking form data: ${key} = ${value}`);
    if ((key.toLowerCase().includes('color') || key.toLowerCase().includes('colour')) && !selectedColor) {
      selectedColor = value;
      console.log('Found color in form data:', selectedColor);
    }
    if (key.toLowerCase().includes('size') && !selectedSize) {
      selectedSize = value;
      console.log('Found size in form data:', selectedSize);
    }
  }
  
  // Try option selectors
  const colorOption = form.querySelector('select[name="options[Color]"], select[name="options[Colour]"]');
  const sizeOption = form.querySelector('select[name="options[Size]"]');
  
  if (colorOption && !selectedColor) {
    selectedColor = colorOption.value;
    console.log('Found color in option selector:', selectedColor);
  }
  if (sizeOption && !selectedSize) {
    selectedSize = sizeOption.value;
    console.log('Found size in option selector:', selectedSize);
  }
}

console.log('🎨 Final detected color:', `"${selectedColor}"`);
console.log('📏 Final detected size:', `"${selectedSize}"`);

// Test the auto-add condition
const softWinterJacketVariantId = '42822036684878';
console.log('🧪 Testing auto-add conditions:');
console.log('  Color === "Black":', selectedColor === 'Black');
console.log('  Size === "M":', selectedSize === 'M');
console.log('  Both conditions met:', selectedColor === 'Black' && selectedSize === 'M');

if (selectedColor === 'Black' && selectedSize === 'M') {
  console.log('✅ AUTO-ADD TRIGGERED! Adding Soft Winter Jacket...');
  
  const fd = new FormData();
  fd.append('id', softWinterJacketVariantId);
  fd.append('quantity', '1');
  
  fetch(Theme.routes.cart_add_url, { 
    ...fetchCfg, 
    body: fd, 
    headers: { ...fetchCfg.headers, Accept: 'application/json' } 
  })
  .then(res => {
    console.log('📡 Auto-add response status:', res.status);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
  })
  .then(res => {
    console.log('✅ Soft Winter Jacket auto-added successfully:', res);
  })
  .catch(err => {
    console.error('❌ Auto-add failed:', err);
  });
} else {
  console.log('❌ Auto-add conditions not met');
  console.log('💡 Need: Color="Black" AND Size="M"');
  console.log(`💡 Got: Color="${selectedColor}" AND Size="${selectedSize}"`);
}

console.log('🎯 === AUTO-ADD LOGIC END ===');