import { Component } from '@theme/component';
import { fetchConfig, preloadImage } from '@theme/utilities';
import { ThemeEvents, CartAddEvent, CartErrorEvent } from '@theme/events';
import { cartPerformance } from '@theme/performance';
import { morph } from '@theme/morph';

export const ADD_TO_CART_TEXT_ANIMATION_DURATION = 2000;

/**
 * AddToCart Component
 */
export class AddToCartComponent extends Component {
  requiredRefs = ['addToCartButton'];
  #animationTimeout;
  #cleanupTimeout;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('pointerenter', this.#preloadImage);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.#animationTimeout);
    clearTimeout(this.#cleanupTimeout);
    this.removeEventListener('pointerenter', this.#preloadImage);
  }

  disable() { this.refs.addToCartButton.disabled = true; }
  enable() { this.refs.addToCartButton.disabled = false; }

  handleClick(event) {
    if (!this.#checkFormValidity()) return;
    this.animateAddToCart();
    if (!event.target.closest('.quick-add-modal')) this.#animateFlyToCart();
  }

  #preloadImage = () => {
    const image = this.dataset.productVariantMedia;
    if (image) preloadImage(image);
  };

  #animateFlyToCart() {
    const { addToCartButton } = this.refs;
    const cartIcon = document.querySelector('.header-actions__cart-icon');
    const image = this.dataset.productVariantMedia;
    if (!cartIcon || !addToCartButton || !image) return;

    const flyToCartElement = document.createElement('fly-to-cart');
    flyToCartElement.style.setProperty('background-image', `url(${image})`);
    flyToCartElement.source = addToCartButton;
    flyToCartElement.destination = cartIcon;
    document.body.appendChild(flyToCartElement);
  }

  animateAddToCart() {
    const { addToCartButton } = this.refs;
    clearTimeout(this.#animationTimeout);
    clearTimeout(this.#cleanupTimeout);
    if (!addToCartButton.classList.contains('atc-added')) {
      addToCartButton.classList.add('atc-added');
    }
    this.#animationTimeout = setTimeout(() => {
      this.#cleanupTimeout = setTimeout(() => {
        addToCartButton.classList.remove('atc-added');
      }, 10);
    }, ADD_TO_CART_TEXT_ANIMATION_DURATION);
  }

  #checkFormValidity() {
    const form = this.closest('form');
    if (!form) return true;
    const allInputs = Array.from(form.querySelectorAll('input, select, textarea')).filter(input =>
      input.id.includes('Recipient')
    );
    return allInputs.every(input => input.disabled || input.checkValidity());
  }
}

if (!customElements.get('add-to-cart-component')) {
  customElements.define('add-to-cart-component', AddToCartComponent);
}

/**
 * ProductForm Component
 */
class ProductFormComponent extends Component {
  requiredRefs = ['variantId', 'liveRegion'];
  #abortController = new AbortController();
  #timeout;
  #autoAddInProgress = false;

  connectedCallback() {
    super.connectedCallback();
    const { signal } = this.#abortController;
    const target = this.closest('.shopify-section, dialog, product-card');
    target?.addEventListener(ThemeEvents.variantUpdate, this.#onVariantUpdate, { signal });
    target?.addEventListener(ThemeEvents.variantSelected, this.#onVariantSelected, { signal });
    
    // Add form change listener for debugging
    const form = this.querySelector('form');
    if (form) {
      form.addEventListener('change', (e) => {
        console.log('📝 Form field changed:', e.target.name, '→', e.target.value);
        setTimeout(() => {
          const currentVariantId = this.refs.variantId?.value;
          console.log('🔍 Variant ID after option change:', currentVariantId);
          if (window.product?.variants) {
            const currentVariant = window.product.variants.find(v => v.id == currentVariantId);
            if (currentVariant) {
              console.log('🎯 Current variant after change:', currentVariant.options?.join(' / '));
            }
          }
        }, 200);
      }, { signal });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abortController.abort();
  }

  // Enhanced product page detection
  #isProductContext() {
    // Method 1: Check URL patterns
    const productUrlPattern = window.location.pathname.includes('/products/');
    
    // Method 2: Check for product-specific elements and data
    const hasProductForm = document.querySelector('.product-form, [data-product-form]') !== null;
    const hasProductData = this.dataset.productId && this.dataset.productId !== '';
    const hasProductJson = window.product && Object.keys(window.product).length > 0;
    
    // Method 3: Check for collection context where auto-add should work
    const isCollectionContext = window.location.pathname.includes('/collections/') && hasProductData;
    const isSearchContext = window.location.pathname.includes('/search') && hasProductData;
    const isQuickBuyContext = this.closest('.quick-add-modal, .quick-buy, [data-quick-buy]') !== null;
    
    // Method 4: Check for cart/checkout exclusions
    const isCartPage = window.location.pathname.includes('/cart');
    const isCheckoutPage = window.location.pathname.includes('/checkout');
    
    const shouldRunAutoAdd = (productUrlPattern || isCollectionContext || isSearchContext || isQuickBuyContext) 
                           && hasProductData 
                           && !isCartPage 
                           && !isCheckoutPage;

    console.log('🏪 Product context analysis:', {
      productUrlPattern,
      hasProductForm,
      hasProductData,
      hasProductJson,
      isCollectionContext,
      isSearchContext,
      isQuickBuyContext,
      isCartPage,
      isCheckoutPage,
      shouldRunAutoAdd,
      currentURL: window.location.pathname,
      productId: this.dataset.productId
    });

    return shouldRunAutoAdd;
  }

  // Enhanced variant detection
  #getVariantDetails(variantId, formData) {
    let selectedColor = '';
    let selectedSize = '';
    
    console.log('🔍 Starting variant detection for ID:', variantId);
    
    // Method 1: Get from variant data (most reliable)
    if (variantId && window.product?.variants) {
      const currentVariant = window.product.variants.find(v => v.id == variantId);
      console.log('🎯 Found variant:', currentVariant);
      
      if (currentVariant?.options) {
        console.log('🔍 Using variant data for detection');
        console.log('📋 Product options names:', window.product.options);
        console.log('📋 Variant options values:', currentVariant.options);
        
        if (window.product.options) {
          window.product.options.forEach((optionName, index) => {
            const optionValue = currentVariant.options[index];
            console.log(`📝 Option ${index}: "${optionName}" = "${optionValue}"`);
            
            const optionNameLower = optionName.toLowerCase();
            if (optionNameLower.includes('color') || optionNameLower.includes('colour')) {
              selectedColor = optionValue;
              console.log('🎨 Color detected from options:', selectedColor);
            }
            if (optionNameLower.includes('size')) {
              selectedSize = optionValue;
              console.log('📏 Size detected from options:', selectedSize);
            }
          });
        } else {
          // Fallback: assume first is color, second is size
          selectedColor = currentVariant.options[0] || '';
          selectedSize = currentVariant.options[1] || '';
          console.log('🔄 Using fallback option order - Color:', selectedColor, 'Size:', selectedSize);
        }
      }
    }

    // Method 2: Enhanced variant ID mapping
    if (!selectedColor || !selectedSize) {
      console.log('🔄 Using enhanced variant ID mapping');
      
      const variantMap = {
        '42822037536846': { color: 'Black', size: 'M' },      // Black + M  
        '42822037405774': { color: 'Black', size: 'XS' },     // Black + XS
        // Add your other variant mappings here
        // Format: 'VARIANT_ID': { color: 'COLOR_NAME', size: 'SIZE_NAME' }
      };
      
      const mappedVariant = variantMap[variantId];
      if (mappedVariant) {
        selectedColor = mappedVariant.color;
        selectedSize = mappedVariant.size;
        console.log('✅ Found variant in mapping:', mappedVariant);
      } else {
        console.log('❌ Variant ID not found in mapping:', variantId);
        console.log('💡 Add this to variantMap:', `'${variantId}': { color: '?', size: '?' }`);
      }
    }

    // Method 3: Form data analysis
    if ((!selectedColor || !selectedSize) && formData) {
      console.log('🔄 Analyzing form data');
      for (let [key, value] of formData.entries()) {
        const keyLower = key.toLowerCase();
        if ((keyLower.includes('color') || keyLower.includes('colour')) && !selectedColor) {
          selectedColor = value;
          console.log('🎨 Color found in form data:', selectedColor);
        }
        if (keyLower.includes('size') && !selectedSize) {
          selectedSize = value;
          console.log('📏 Size found in form data:', selectedSize);
        }
      }
    }

    return { selectedColor, selectedSize };
  }

  // Enhanced auto-add logic
  async #processAutoAdd(variantId, formData) {
    if (this.#autoAddInProgress) {
      console.log('⚠️ Auto-add already in progress, skipping...');
      return;
    }

    const { selectedColor, selectedSize } = this.#getVariantDetails(variantId, formData);
    
    console.log('🎨 FINAL detected color:', `"${selectedColor}" (type: ${typeof selectedColor})`);
    console.log('📏 FINAL detected size:', `"${selectedSize}" (type: ${typeof selectedSize})`);
    
    // Auto-add conditions
    const softWinterJacketVariantId = '42822036684878';
    const targetConditions = [
      { color: 'Black', size: 'M', desc: 'Black + M' },
      { color: 'Black', size: 'Medium', desc: 'Black + Medium' }
    ];
    
    const shouldAutoAdd = targetConditions.some(condition => {
      const colorMatch = selectedColor.toLowerCase().trim() === condition.color.toLowerCase().trim();
      const sizeMatch = selectedSize.toLowerCase().trim() === condition.size.toLowerCase().trim();
      return colorMatch && sizeMatch;
    });

    if (!shouldAutoAdd) {
      console.log('❌ AUTO-ADD CONDITIONS NOT MET');
      console.log(`💡 Required: Black + (M or Medium), Got: ${selectedColor} + ${selectedSize}`);
      return;
    }

    console.log('🚀 AUTO-ADD TRIGGERED! Adding Soft Winter Jacket...');
    this.#autoAddInProgress = true;

    try {
      const autoAddFormData = new FormData();
      autoAddFormData.append('id', softWinterJacketVariantId);
      autoAddFormData.append('quantity', '1');
      
      const response = await fetch(Theme.routes.cart_add_url, {
        method: 'POST',
        body: autoAddFormData,
        headers: { 
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.status) {
        console.error('❌ Auto-add error:', result.message, result.description);
      } else {
        console.log('✅ Soft Winter Jacket auto-added successfully!');
        
        // Dispatch custom event for cart updates
        document.dispatchEvent(new CustomEvent('cart:updated', { 
          detail: { 
            autoAdded: true, 
            variantId: softWinterJacketVariantId,
            response: result 
          } 
        }));
      }
    } catch (error) {
      console.error('❌ Auto-add failed:', error);
    } finally {
      // Clear flag after delay
      setTimeout(() => {
        this.#autoAddInProgress = false;
        console.log('🔄 Auto-add flag cleared');
      }, 2000);
    }
  }

  handleSubmit(event) {
    console.log('🚀 === FORM SUBMIT DEBUG ===');
    console.log('🎯 Event type:', event.type);
    console.log('🎯 Event target:', event.target);
    console.log('🎯 Form submission source:', this.closest('.shopify-section')?.id || 'unknown');
    
    const form = this.querySelector('form');
    const formData = new FormData(form);
    const submittedVariantId = formData.get('id');
    
    console.log('📤 Submitted variant ID:', submittedVariantId);
    console.log('📤 Variant input element value:', this.refs.variantId?.value);
    console.log('📤 Current URL:', window.location.pathname);
    
    const isProductContext = this.#isProductContext();
    console.log('🏪 Is product context:', isProductContext);
    
    // Check if the submitted ID matches any known variant
    if (window.product?.variants) {
      const matchingVariant = window.product.variants.find(v => v.id == submittedVariantId);
      if (matchingVariant) {
        console.log('✅ Submitted variant found:', matchingVariant);
        console.log('   Title:', matchingVariant.title);
        console.log('   Options:', matchingVariant.options);
      } else {
        console.log('❌ Submitted variant ID not found in product variants!');
        console.log('Available variant IDs:', window.product.variants.map(v => v.id));
      }
    }
    
    console.log('🚀 === FORM SUBMIT DEBUG END ===');

    const { addToCartTextError } = this.refs;
    event.preventDefault();
    clearTimeout(this.#timeout);

    if (this.refs.addToCartButtonContainer?.refs.addToCartButton?.disabled) return;

    if (!form) throw new Error('Product form element missing');

    const cartItemsComponents = document.querySelectorAll('cart-items-component');
    const cartItemComponentsSectionIds = [];
    cartItemsComponents.forEach(item => {
      if (item.dataset.sectionId) cartItemComponentsSectionIds.push(item.dataset.sectionId);
      formData.append('sections', cartItemComponentsSectionIds.join(','));
    });

    const fetchCfg = fetchConfig('javascript', { body: formData });

    fetch(Theme.routes.cart_add_url, {
      ...fetchCfg,
      headers: { ...fetchCfg.headers, Accept: 'text/html' },
    })
      .then(res => res.json())
      .then(response => {
        if (response.status) {
          this.dispatchEvent(new CartErrorEvent(form.id || '', response.message, response.description, response.errors));
          if (addToCartTextError) {
            addToCartTextError.classList.remove('hidden');
            const textNode = addToCartTextError.childNodes[2];
            if (textNode) textNode.textContent = response.message;
            else addToCartTextError.appendChild(document.createTextNode(response.message));
            this.#setLiveRegionText(response.message);
            this.#timeout = setTimeout(() => {
              addToCartTextError?.classList.add('hidden');
              this.#clearLiveRegionText();
            }, 10000);
          }
          this.dispatchEvent(new CartAddEvent({}, this.id, {
            didError: true,
            source: 'product-form-component',
            itemCount: Number(formData.get('quantity')) || Number(this.dataset.quantityDefault),
            productId: this.dataset.productId,
          }));
          return;
        }

        const id = formData.get('id');
        if (!id) throw new Error('Form ID is required');

        addToCartTextError?.classList.add('hidden');
        addToCartTextError?.removeAttribute('aria-live');

        if (this.refs.addToCartButtonContainer?.refs.addToCartButton) {
          const addToCartButton = this.refs.addToCartButtonContainer.refs.addToCartButton;
          const addedText = addToCartButton.querySelector('.add-to-cart-text--added')?.textContent?.trim() || Theme.translations.added;
          this.#setLiveRegionText(addedText);
          setTimeout(() => this.#clearLiveRegionText(), 5000);
        }

        this.dispatchEvent(new CartAddEvent({}, id.toString(), {
          source: 'product-form-component',
          itemCount: Number(formData.get('quantity')) || Number(this.dataset.quantityDefault),
          productId: this.dataset.productId,
          sections: response.sections,
        }));

        // Enhanced auto-add logic
        if (!isProductContext) {
          console.log('🚫 Skipping auto-add - not in valid product context');
          return;
        }

        console.log('🎯 === AUTO-ADD LOGIC START ===');
        this.#processAutoAdd(id, formData);
        console.log('🎯 === AUTO-ADD LOGIC END ===');
      })
      .catch(err => console.error(err))
      .finally(() => cartPerformance.measureFromEvent('add:user-action', event));
  }

  #setLiveRegionText(text) { this.refs.liveRegion.textContent = text; }
  #clearLiveRegionText() { this.refs.liveRegion.textContent = ''; }

  #onVariantUpdate = (event) => {
    console.log('🔄 === VARIANT UPDATE EVENT ===');
    console.log('Event resource:', event.detail.resource);
    
    if (event.detail.data.newProduct) {
      this.dataset.productId = event.detail.data.newProduct.id;
    } else if (event.detail.data.productId !== this.dataset.productId) {
      return;
    }

    const { variantId, addToCartButtonContainer } = this.refs;
    const currentAddToCartButton = addToCartButtonContainer?.refs.addToCartButton;
    const newAddToCartButton = event.detail.data.html.querySelector('[ref="addToCartButton"]');
    
    console.log('🎯 Current variant ID BEFORE update:', variantId?.value);
    
    if (!currentAddToCartButton) return;

    if (!event.detail.resource || !event.detail.resource.available) {
      addToCartButtonContainer.disable();
      this.refs.acceleratedCheckoutButtonContainer?.setAttribute('hidden', 'true');
    } else {
      addToCartButtonContainer.enable();
      this.refs.acceleratedCheckoutButtonContainer?.removeAttribute('hidden');
    }

    if (newAddToCartButton) morph(currentAddToCartButton, newAddToCartButton);
    
    const newVariantId = event.detail.resource.id ?? '';
    console.log('🎯 Setting variant ID to:', newVariantId);
    variantId.value = newVariantId;
    console.log('🎯 Variant ID AFTER update:', variantId.value);
    
    // Verify the update worked
    setTimeout(() => {
      console.log('🕐 Variant ID after timeout:', variantId.value);
    }, 100);
    
    if (event.detail.resource?.featured_media?.preview_image?.src) {
      addToCartButtonContainer?.setAttribute('data-product-variant-media', event.detail.resource.featured_media.preview_image.src + '&width=100');
    }
    
    console.log('🔄 === VARIANT UPDATE COMPLETE ===');
  };

  #onVariantSelected = () => { this.refs.addToCartButtonContainer?.disable(); };
}

if (!customElements.get('product-form-component')) {
  customElements.define('product-form-component', ProductFormComponent);
}

/**
 * FlyToCart Animation
 */
class FlyToCart extends HTMLElement {
  source;
  destination;

  connectedCallback() { this.#animate(); }

  #animate() {
    const sourceRect = this.source.getBoundingClientRect();
    const destinationRect = this.destination.getBoundingClientRect();
    const flyEl = this;

    flyEl.style.position = 'fixed';
    flyEl.style.top = `${sourceRect.top}px`;
    flyEl.style.left = `${sourceRect.left}px`;
    flyEl.style.width = `${sourceRect.width}px`;
    flyEl.style.height = `${sourceRect.height}px`;
    flyEl.style.backgroundSize = 'cover';
    flyEl.style.transition = 'all 0.6s ease-in-out';
    document.body.appendChild(flyEl);

    requestAnimationFrame(() => {
      flyEl.style.top = `${destinationRect.top}px`;
      flyEl.style.left = `${destinationRect.left}px`;
      flyEl.style.width = `${destinationRect.width}px`;
      flyEl.style.height = `${destinationRect.height}px`;
    });

    flyEl.addEventListener('transitionend', () => flyEl.remove(), { once: true });
  }
}

if (!customElements.get('fly-to-cart')) {
  customElements.define('fly-to-cart', FlyToCart);
}

// Enhanced debugging helper
window.checkCurrentVariant = function() {
  const form = document.querySelector('product-form-component form');
  const variantInput = form?.querySelector('input[name="id"]');
  const currentId = variantInput?.value;
  
  console.log('🔍 MANUAL VARIANT CHECK:');
  console.log('Current variant ID:', currentId);
  
  if (window.product?.variants && currentId) {
    const variant = window.product.variants.find(v => v.id == currentId);
    if (variant) {
      console.log('Variant details:', variant.options?.join(' / '));
      console.log('Full variant object:', variant);
    } else {
      console.log('❌ Variant not found!');
    }
  }
  
  // Check context
  const productForm = document.querySelector('product-form-component');
  if (productForm) {
    console.log('Product context check:', {
      isProductUrl: window.location.pathname.includes('/products/'),
      hasProductId: !!productForm.dataset.productId,
      isCollection: window.location.pathname.includes('/collections/'),
      currentUrl: window.location.pathname
    });
  }
  
  // Show all available variants
  if (window.product?.variants) {
    console.log('All available variants:');
    window.product.variants.forEach(v => {
      console.log(`  ID: ${v.id}, Options: ${v.options?.join(' / ')}, Available: ${v.available}`);
    });
  }
};

// Add debugging for cart updates
document.addEventListener('cart:updated', (event) => {
  if (event.detail.autoAdded) {
    console.log('🛒 Cart updated via auto-add:', event.detail);
  }
});