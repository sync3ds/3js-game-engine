import * as THREE from 'three';
import { SkeletonUtils } from '../libs/utils/SkeletonUtils.js';

/**
* Class for representing the global animation manager. It is responsible
* for loading and parsing all animations from the backend, adding them on each 3D model
* and executing cross fades.
**/
class AnimationManager {

	/**
	* Constructs a new animation manager with the given values.
	*/
	constructor( assetManager ) {
		this.engine = assetManager.engine;
		this.assetManager = assetManager;
		this.animTransactionDuration = 1.0;
		this.animations = new Map();
	}

	initAnimations(model){

		console.log("Initializing animations for "+model.name);

		var scope = this;

		if(model.animations.length > 0){
			model.skeletonHelper = new THREE.SkeletonHelper(model);
			model.freezeAnimations = false;
			model.mixer = new THREE.AnimationMixer(model);
			for (let clip of model.animations){
				let action = model.mixer.clipAction(clip);
				action.name = clip.name;
				this.setWeight(action, 0.0);
				if(action.name == model.settings.animations.default){
					model.currentAction = action;
					this.engine.controlsManager.playerControls.action = action.name;
					this.setWeight(action, 1.0);
					action.play();
				}
			}

		}

	}

	setWeight( action, weight ) {
		action.enabled = true;
		action.setEffectiveTimeScale(1);
		action.setEffectiveWeight(weight);
		action.time = 0;
	}

	swapAnimation( model, endAction, nextAction ) {
		var scope = this;
		var clip = THREE.AnimationClip.findByName( model.animations, endAction );
		var action = model.mixer.clipAction( clip );
		this.setWeight( action, 1.0 );
		action.play();
		action.crossFadeFrom( model.currentAction, model.settings.animations.swapSpeed, false );
		model.currentAction = action;
		model.nextAction = nextAction;
		if(nextAction){
			let tmpTime = (clip.duration - model.settings.animations.swapSpeed) * 1000;
			setTimeout(function(model){
				document.dispatchEvent(new CustomEvent('animation.nextActionStarted', { nextActionCalled: model.nextAction }));
				scope.swapAnimation( model, model.nextAction, null );
			}, tmpTime, model);
		}
	}



}

export { AnimationManager };
