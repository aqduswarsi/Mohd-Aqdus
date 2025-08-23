import { Component } from '@theme/component';
import { fetchConfig, onAnimationEnd, preloadImage } from '@theme/utilities';
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

  connectedCallback() {
    super.connectedCallback();
    const { signal } = this.#abortController;
    const target = this.closest('.shopify-section, dialog, product-card');
    target?.addEventListener(ThemeEvents.variantUpdate, this.#onVariantUpdate, { signal });
    target?.addEventListener(ThemeEvents.variantSelected, this.#onVariantSelected, { signal });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abortController.abort();
  }

  handleSubmit(event) {
    const { addToCartTextError } = this.refs;
    event.preventDefault();
    clearTimeout(this.#timeout);

    if (this.refs.addToCartButtonContainer?.refs.addToCartButton?.disabled) return;

    const form = this.querySelector('form');
    if (!form) throw new Error('Product form element missing');
    const formData = new FormData(form);

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
          if (!addToCartTextError) return;
          addToCartTextError.classList.remove('hidden');
          const textNode = addToCartTextError.childNodes[2];
          if (textNode) textNode.textContent = response.message;
          else addToCartTextError.appendChild(document.createTextNode(response.message));
          this.#setLiveRegionText(response.message);
          this.#timeout = setTimeout(() => {
            addToCartTextError?.classList.add('hidden');
            this.#clearLiveRegionText();
          }, 10000);
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

        // ✅ Auto-add Soft Winter Jacket (Black + M)
        const selects = Array.from(form.querySelectorAll('select')).filter(s => s.name.includes('options['));
        let selectedSize = '', selectedColor = '';
        selects.forEach(s => {
          const name = s.name.toLowerCase();
          if (name.includes('size')) selectedSize = s.value;
          if (name.includes('color')) selectedColor = s.value;
        });

        const softWinterJacketVariantId = 1234567890; // Replace with real variant ID
        if (selectedColor === 'Black' && selectedSize === 'M') {
          const fd = new FormData();
          fd.append('id', softWinterJacketVariantId);
          fd.append('quantity', '1');
          fetch(Theme.routes.cart_add_url, { ...fetchCfg, body: fd, headers: { ...fetchCfg.headers, Accept: 'application/json' } })
            .then(res => res.json())
            .then(res => console.log('Soft Winter Jacket auto-added', res))
            .catch(err => console.error(err));
        }
      })
      .catch(err => console.error(err))
      .finally(() => cartPerformance.measureFromEvent('add:user-action', event));
  }

  #setLiveRegionText(text) { this.refs.liveRegion.textContent = text; }
  #clearLiveRegionText() { this.refs.liveRegion.textContent = ''; }

  #onVariantUpdate = (event) => {
    if (event.detail.data.newProduct) this.dataset.productId = event.detail.data.newProduct.id;
    else if (event.detail.data.productId !== this.dataset.productId) return;

    const { variantId, addToCartButtonContainer } = this.refs;
    const currentAddToCartButton = addToCartButtonContainer?.refs.addToCartButton;
    const newAddToCartButton = event.detail.data.html.querySelector('[ref="addToCartButton"]');
    if (!currentAddToCartButton) return;

    if (!event.detail.resource || !event.detail.resource.available) {
      addToCartButtonContainer.disable();
      this.refs.acceleratedCheckoutButtonContainer?.setAttribute('hidden', 'true');
    } else {
      addToCartButtonContainer.enable();
      this.refs.acceleratedCheckoutButtonContainer?.removeAttribute('hidden');
    }

    if (newAddToCartButton) morph(currentAddToCartButton, newAddToCartButton);
    variantId.value = event.detail.resource.id ?? '';
    if (event.detail.resource?.featured_media?.preview_image?.src) {
      addToCartButtonContainer?.setAttribute('data-product-variant-media', event.detail.resource.featured_media.preview_image.src + '&width=100');
    }
  };

  #onVariantSelected = () => { this.refs.addToCartButtonContainer?.disable(); };
}

if (!customElements.get('product-form-component')) {
  customElements.define('product-form-component', ProductFormComponent);
}

/**
 * Premium FlyToCart Animation
 */
class FlyToCart extends HTMLElement {
  source;
  destination;

  connectedCallback() { this.#animate(); }

  #animate() {
    const rect = this.getBoundingClientRect();
    const sourceRect = this.source.getBoundingClientRect();
    const destinationRect = this.destination.getBoundingClientRect();
    const offset = {