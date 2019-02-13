/**
 * `spriteful-cms-inventory`
 * choose from available client shop items and edit them
 *
 * @customElement
 * @polymer
 * @demo demo/index.html
 */
import {
	PolymerElement, 
	html
}  								from '@polymer/polymer/polymer-element.js';
import {
	GestureEventListeners
} 								from '@polymer/polymer/lib/mixins/gesture-event-listeners.js';
import {
	SpritefulMixin
}        					from '@spriteful/spriteful-mixin/spriteful-mixin.js';
import {
  isOnScreen,
  listen,
  schedule
}                 from '@spriteful/utils/utils.js';
import htmlString from './asg-shop-card-item-image.html';
import '@spriteful/asg-shop-card-shared-elements/asg-shop-card-badges.js';
import '@polymer/iron-image/iron-image.js';


class ASGShopCardItemImage extends SpritefulMixin(GestureEventListeners(PolymerElement)) {
  static get is() { return 'asg-shop-card-item-image'; }

  static get template() {
    return html([htmlString]);
  }


  static get properties() {
    return {

      card: Object,
      // touch flick decay positive int greater than 0
      decay: {
        type: Number,
        value: 10 // default: 2, adjust to taste
      },
      // overscroll effect decay rate
      overScroll: {
        type: Number,
        value: 8  // default: 5, adjust to taste
      },
      // ref to parent element so its width can be dynamically measured
      parent: Object,
      // number of pixels before the user has slid the image
      // far enough to consider the intent to toggle the image
      trackToggleThreshold: {
        type: Number,
        value: 58
      },

      _cancelFlick: Boolean,
      // img track pos
      _currentX: {
        type: Number,
        value: -1
      },
      // cached val from touch event handler
      _finalVelocity: Number,

      _image: {
        type: String,
        computed: '__computeImage(card)'
      },

      _lazyImage: String,

      _leftX: {
        type: Number, 
        value: -1
      },

      _leftThreshold: {
        type: Number,
        computed: '__computeLeftThreshold(_leftX, trackToggleThreshold)'
      },

      _rightX: {
        type: Number,
        observer: '__rightXChanged'
      },

      _rightThreshold: {
        type: Number,
        computed: '__computeRightThreshold(_rightX, trackToggleThreshold)'
      }

    };
  }


  static get observers() {
    return [
      '__currentXChanged(_currentX)',
      '__cardChanged(card)'
    ];
  }


  connectedCallback() {
    super.connectedCallback();

    listen(
      window, 
      'resize', 
      this.__measureWidthForImgTransition.bind(this)
    );    
    this.__iosBorderRadiusFix();
    this.__measureWidthForImgTransition();
  }

  // safari does not respect the parent elements border-radius and overflow
  __iosBorderRadiusFix() {
    const imgSizedImgDiv                = this.select('#sizedImgDiv', this.$.img);
    const imgPlaceholder                = this.select('#placeholder', this.$.img);
    imgSizedImgDiv.style.borderRadius   = '8px';
    imgPlaceholder.style.borderRadius   = '8px';
    imgPlaceholder.style.overflow       = 'hidden';
    imgPlaceholder.style.backgroundClip = 'border-box';
  }


  __computeImage(card) {
    if (!card) { return '#'; }
    const {image_uris, card_faces} = card;
    return image_uris ? image_uris.small : card_faces[0].image_uris.small;
  }


  __computeLeftThreshold(leftX, threshold) {
    return leftX + threshold;
  }


  __computeRightThreshold(rightX, threshold) {
    return rightX - threshold;
  }


  __currentXChanged(x) {
    if (x === this._leftX) {
      this.fire('asg-shop-card-item-image-close-condition');
      this.__animateToLeftHideActions();
    }
    else if (x === this._rightX) {
      this.__animateToRightHideDescription();
    }
  }

  // correct for screen resize if img was tracked last
  __rightXChanged(curr, prev) {
    if (this._currentX === prev) {
      this._currentX = curr;
    }
  }
  // put card img back to left any time incoming card data changes
  // lazy load image
  async __cardChanged() {
    this._currentX = this._leftX;
    await isOnScreen(this);
    this._lazyImage = this._image;
  }


  async __measureWidthForImgTransition() {
    await schedule();
    const {width} = this.parent.getBoundingClientRect();
    if (!width) { return; }
    this.updateStyles({
      '--img-transition-distance': `${width}px`,
    });
    this._rightX = width - 115; // 115 is the width of the image - 1 pixel
  }


  __hideActions() {
    this.fire('asg-shop-card-item-image-hide-actions');
  }


  __animateToLeftHideActions() {
    this.$.imgWrapper.classList.remove('img-right');
    this.__hideActions();
  }


  __enterDescription() {
    this.fire('asg-shop-card-item-image-enter-description');
  }


  __hideDescription() {
    this.fire('asg-shop-card-item-image-hide-description');
  }


  __animateToRightHideDescription() {
    this.$.imgWrapper.classList.add('img-right');
    this.__hideDescription();
  }


  __enterActions() {
    this.fire('asg-shop-card-item-image-enter-actions');
  }


  __cardImageTransitionend(event) {
    if (event.propertyName !== 'transform') { return; }
    if (this._currentX === this._leftX) {
      this.__enterDescription(); 
    }
    else if (this._currentX === this._rightX) {
      this.__enterActions();
    }
  }


  async __cardImageClicked() {
    try {
      await this.clicked();
      this.__cleanUpCardImageTrack();
      if (this.$.imgWrapper.classList.contains('img-right')) {
        this._currentX = this._leftX;
      }
      else {
        this._currentX = this._rightX;
      }
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
    }
  }


  __getSoftClampedX(x, min, max, rate) {
    if (x < min) {
      const delta = x - min;
      return min - (Math.abs(delta / rate));
    } else if (x > max) {
      const delta = x - max;
      return max + (Math.abs(delta / rate));
    }
    return x;
  }


  __translateImage(x) {
    const clampedX = this.__getSoftClampedX(x, this._leftX, this._rightX, this.overScroll);
    this.$.imgWrapper.style.transform = `translateX(${clampedX}px)`;
  }


  __cardImageOnDown() {
    this._cancelFlick = true;
  }


  __xHasHitLeftEndpoint() {
    return this._currentX <= this._leftX;
  }


  __xHasHitRightEndpoint() {
    return this._currentX >= this._rightX;
  }


  __getNearestRestingPos(x, direction) {
    if (direction === 'right') {
      if (x < this._rightX - this.trackToggleThreshold) {
        return this._leftX;
      }
      return this._rightX;
    }
    if (direction === 'left') {
      if (x < this.trackToggleThreshold) {
        return this._leftX;
      }
      return this._rightX;
    }
    return x;
  }


  __cleanUpCardImageTrack() {
    this.$.imgWrapper.style.transform = '';
    this.$.imgWrapper.classList.add('img-transition');
  }


  __hideContentIfInBetweenThresholds(x) {
    if (x > this._leftThreshold && x < this._rightThreshold) {
      this.__hideActions();
      this.__hideDescription();
    }    
  }


  async __cardImageTracked(event) {
    await schedule();
    const {dx, ddx, state, x} = event.detail;

    switch (state) {
      case 'start':
        this._cancelFlick = true;
        this.$.imgWrapper.classList.remove('img-transition');
        break;
      case 'track':
        this._finalVelocity = ddx;
        const newX          = this._currentX + dx;
        this.__hideContentIfInBetweenThresholds(newX);
        this.__translateImage(newX);
        break;
      case 'end':
        const initialDirection = this._finalVelocity < 0 ? 'right' : 'left';
        this._cancelFlick      = false;
        this._currentX         = this._currentX + dx;

        const flickDecay = (velocity, direction) => {
          if (this._cancelFlick) { 
            this.__cleanUpCardImageTrack();
            return; 
          }
          if (velocity <= this.decay && velocity >= -this.decay) { // done accelerating
            const nearestRestingPos = this.__getNearestRestingPos(this._currentX, direction);
            this.__cleanUpCardImageTrack();
            this._currentX = nearestRestingPos;
            return;
          } else if (velocity > this.decay) { // accelerating left
            this._currentX += velocity; // velocity starts as a positive int and approches 0
            if (this.__xHasHitLeftEndpoint()) { 
              velocity = this.decay;
            }
            window.requestAnimationFrame(() => flickDecay(velocity - this.decay, 'left'));
          } else if (velocity < -this.decay) { // accelerating right
            this._currentX += velocity; // velocity starts as a positive int and approches 0
            if (this.__xHasHitRightEndpoint()) { 
              velocity = -this.decay;
            }
            window.requestAnimationFrame(() => flickDecay(velocity + this.decay, 'right'));
          }
          this.__translateImage(this._currentX);
        };

        window.requestAnimationFrame(() => flickDecay(this._finalVelocity, initialDirection));
        break;
    }
  }

}

window.customElements.define(ASGShopCardItemImage.is, ASGShopCardItemImage);
