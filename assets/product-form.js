import { Component } from '@theme/component';
import { fetchConfig, onAnimationEnd, preloadImage } from '@theme/utilities';
import { ThemeEvents, CartAddEvent, CartErrorEvent, VariantUpdateEvent } from '@theme/events';
import { cartPerformance } from '@theme/performance';
import { morph } from '@theme/morph';

export const ADD_TO_CART_TEXT_ANIMATION_DURATION = 2000;

/**
 * A custom element that manages an add to cart button.
 *
 * @typedef {object} AddToCartRefs
 * @property {HTMLButtonElement} addToCartButton - The add to cart button.
 * @extends Component<AddToCartRefs>
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
    if (this.#animationTimeout) clearTimeout(this.#animationTimeout);
    if (this.#cleanupTimeout) clearTimeout(this.#cleanupTimeout);
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
    if (!image) return;
    preloadImage(image);
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
    if (this.#animationTimeout) clearTimeout(this.#animationTimeout);
    if (this.#cleanupTimeout) clearTimeout(this.#cleanupTimeout);
    if (!addToCartButton.classList.contains('atc-added')) {
      addToCartButton.classList.add('atc-added');
    }
    this.#animationTimeout = setTimeout(() => {
      this.#cleanupTimeout = setTimeout(() => {
        this.refs.addToCartButton.classList.remove('atc-added');
      }, 10);
    }, ADD_TO_CART_TEXT_ANIMATION_DURATION);
  }

  #checkFormValidity() {
    const form = this.closest('form');
    if (!form) return true;
    const allInputs = Array.from(form.querySelectorAll('input, select, textarea')).filter((input) =>
      input.id.includes('Recipient')
    );
    let allInputsValid = true;
    for (const input of allInputs) {
      if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) continue;
      if (input.disabled) continue;
      if (!input.checkValidity()) {
        allInputsValid = false;
        break;
      }
    }
    return allInputsValid;
  }
}

if (!customElements.get('add-to-cart-component')) {
  customElements.define('add-to-cart-component', AddToCartComponent);
}

/**
 * Product Form Component
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
    if (this.#timeout) clearTimeout(this.#timeout);
    if (this.refs.addToCartButtonContainer?.refs.addToCartButton?.getAttribute('disabled') === 'true') return;

    const form = this.querySelector('form');
    if (!form) throw new Error('Product form element missing');
    const formData = new FormData(form);

    const cartItemsComponents = document.querySelectorAll('cart-items-component');
    let cartItemComponentsSectionIds = [];
    cartItemsComponents.forEach((item) => {
      if (item instanceof HTMLElement && item.dataset.sectionId) {
        cartItemComponentsSectionIds.push(item.dataset.sectionId);
      }
      formData.append('sections', cartItemComponentsSectionIds.join(','));
    });

    const fetchCfg = fetchConfig('javascript', { body: formData });

    fetch(Theme.routes.cart_add_url, {
      ...fetchCfg,
      headers: { ...fetchCfg.headers, Accept: 'text/html' },
    })
      .then((response) => response.json())
      .then((response) => {
        if (response.status) {
          this.dispatchEvent(
            new CartErrorEvent(form.getAttribute('id') || '', response.message, response.description, response.errors)
          );
          if (!addToCartTextError) return;
          addToCartTextError.classList.remove('hidden');
          const textNode = addToCartTextError.childNodes[2];
          if (textNode) textNode.textContent = response.message;
          else addToCartTextError.appendChild(document.createTextNode(response.message));
          this.#setLiveRegionText(response.message);
          this.#timeout = setTimeout(() => {
            if (!addToCartTextError) return;
            addToCartTextError.classList.add('hidden');
            this.#clearLiveRegionText();
          }, 10000);
          this.dispatchEvent(
            new CartAddEvent({}, this.id, {
              didError: true,
              source: 'product-form-component',
              itemCount: Number(formData.get('quantity')) || Number(this.dataset.quantityDefault),
              productId: this.dataset.productId,
            })
          );
          return;
        } else {
          const id = formData.get('id');
          if (addToCartTextError) {
            addToCartTextError.classList.add('hidden');
            addToCartTextError.removeAttribute('aria-live');
          }
          if (!id) throw new Error('Form ID is required');
          if (this.refs.addToCartButtonContainer?.refs.addToCartButton) {
            const addToCartButton = this.refs.addToCartButtonContainer.refs.addToCartButton;
            const addedTextElement = addToCartButton.querySelector('.add-to-cart-text--added');
            const addedText = addedTextElement?.textContent?.trim() || Theme.translations.added;
            this.#setLiveRegionText(addedText);
            setTimeout(() => this.#clearLiveRegionText(), 5000);
          }
          this.dispatchEvent(
            new CartAddEvent({}, id.toString(), {
              source: 'product-form-component',
              itemCount: Number(formData.get('quantity')) || Number(this.dataset.quantityDefault),
              productId: this.dataset.productId,
              sections: response.sections,
            })
          );

          // ✅ Auto-add Soft Winter Jacket if Black + Medium variant is added
          const selectedSize = form.querySelector('select[name="options[Size]"]')?.value;
          const selectedColor = form.querySelector('select[name="options[Color]"]')?.value;
          const softWinterJacketVariantId = 1234567890; // Replace with real variant ID
          if (selectedColor === 'Black' && selectedSize === 'M') {
            const fd = new FormData();
            fd.append('id', softWinterJacketVariantId);
            fd.append('quantity', '1');
            fetch(Theme.routes.cart_add_url, {
              ...fetchCfg,
              body: fd,
              headers: { ...fetchCfg.headers, Accept: 'application/json' },
            })
              .then((res) => res.json())
              .then((res) => console.log('Soft Winter Jacket auto-added', res))
              .catch((err) => console.error(err));
          }
        }
      })
      .catch((error) => console.error(error))
      .finally(() => {
        cartPerformance.measureFromEvent('add:user-action', event);
      });
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

    if (event.detail.resource == null || event.detail.resource.available == false) {
      addToCartButtonContainer.disable();
      this.refs.acceleratedCheckoutButtonContainer?.setAttribute('hidden', 'true');
    } else {
      addToCartButtonContainer.enable();
      this.refs.acceleratedCheckoutButtonContainer?.removeAttribute('hidden');
    }

    if (newAddToCartButton) morph(currentAddToCartButton, newAddToCartButton);
    variantId.value = event.detail.resource.id ?? '';
    if (event.detail.resource) {
      const productVariantMedia = event.detail.resource.featured_media?.preview_image?.src;
      productVariantMedia && addToCartButtonContainer?.setAttribute('data-product-variant-media', productVariantMedia + '&width=100');
    }
  };

  #onVariantSelected = () => { this.refs.addToCartButtonContainer?.disable(); };
}

if (!customElements.get('product-form-component')) {
  customElements.define('product-form-component', ProductFormComponent);
}

/**
 * FlyToCart animation element
 */
class FlyToCart extends HTMLElement {
  source;
  destination;
  connectedCallback() { this.#animate(); }
  #animate() {
    const rect = this.getBoundingClientRect();
    const sourceRect = this.source.getBoundingClientRect();
    const destinationRect = this.destination.getBoundingClientRect();
    const offset = { x: rect.width / 2, y: rect.height / 2 };
    const startPoint = { x: sourceRect.left + sourceRect.width / 2 - offset.x