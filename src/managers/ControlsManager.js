import * as THREE from 'three';

import { OrbitControls } from '../libs/controls/OrbitControls.js';
import { SightControls } from '../libs/controls/SightControls2.js';

export class ControlsManager {

	constructor(engine){
		this.engine = engine;
		this.ready = false;

		this.cameraType = 'sight'; // follow/orbit/sight 
		this.currentCamera = null;

		this.playerControls = {
			freeze: false, // while true cannot be assigned new actions to the model
			status: 'run', // walk | run
			move: null, // null | forward | backward
			turn: null, // null | left | right
			jump: false, // false | true
			attacking: false, // false | true
			action: null // set dinamically
		};

		this.cameraControls = {
			dampingFactor: 0.6
		};

	}

	init(){
		var scope = this;

		this.cameraControls.distanceFromFloor = this.engine.player.settings.camera.distanceFromFloor;
		this.cameraControls.targetRadius = this.engine.player.settings.camera.targetRadius;
		this.cameraControls.lookAtOffset = this.engine.player.settings.camera.lookAtOffset;

		switch(this.cameraType) {

			case 'orbit':
				let targetPos = new THREE.Vector3().copy(this.engine.player.position);
				targetPos.y = 2;
				this.engine.renderingManager.camera.position.set(2, 4, 6);
				this.engine.renderingManager.camera.lookAt(targetPos);
				this.controls = new OrbitControls( this.engine.renderingManager.camera, document.body );
				this.controls.isLocked = true;
				this.controls.target = targetPos;
				this.engine.renderingManager.divBlocker.style.display = 'none';
				this.currentCamera = this.engine.renderingManager.camera;
				break;

			case 'sight':
				let playerPos = this.engine.player.position.clone();
				playerPos.y = this.cameraControls.distanceFromFloor;
				playerPos.x = this.cameraControls.targetRadius;
				this.engine.renderingManager.divBlocker.style.display = 'block';
				this.engine.renderingManager.followCamera.position.copy(playerPos);
				this.controls = new SightControls( this.engine.renderingManager.followCamera, document.body, this.engine.player, this.engine);
				this.controls.setPhysicsManager(this.engine.physicsManager);
				this.controls.minDistance = 0.5;
				this.controls.maxDistance = this.cameraControls.targetRadius;
				this.controls.radius = this.controls.maxDistance;
				this.controls.rotateSpeed = 4;
				this.controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
				this.controls.addEventListener( 'lock', function () {
					scope.engine.renderingManager.divBlocker.style.display = 'none';
				} );
				this.controls.addEventListener( 'unlock', function () {
					scope.engine.renderingManager.divBlocker.style.display = 'block';
				} );
				this.engine.renderingManager.divBlocker.addEventListener( 'click', function () {
					scope.controls.lock();
				}, false );
				this.currentCamera = this.engine.renderingManager.followCamera;
				break;

			case 'follow':
				this.controls = { isLocked: true };
				this.engine.renderingManager.followCamera.position.copy(this.engine.player.position);
				this.currentCamera = this.engine.renderingManager.followCamera;
				break;

		}

		this.initListeners();

	}

	initListeners(){
		var scope = this;

		var onKeyDown = function ( event ) {
			switch ( event.keyCode ) {

				case 16: // shift
					scope.engine.renderingManager.swapCamera(scope.engine.renderingManager.debugCamera);
					break;

				case 87: // w
					scope.playerControls.move = "forward";
					break;

				case 65: // a
					scope.playerControls.turn = "left";
					break;

				case 83: // s
					scope.playerControls.move = "backward";
					break;

				case 68: // d
					scope.playerControls.turn = "right";
					break;

				case 69: // e
					scope.playerControls.attacking = true;
					scope.playerControls.attackMode = "special";
					break;

				case 32: // space
					if(!scope.playerControls.jumping){
						scope.playerControls.jump = true;
					}

					break;

			}

		};

		var onKeyUp = function ( event ) {
			switch ( event.keyCode ) {

				case 16: // shift
					scope.engine.renderingManager.swapCamera(scope.engine.renderingManager.followCamera);
					break;

				case 87: // w
					scope.playerControls.move = null;
					break;

				case 65: // a
					scope.playerControls.turn = null;
					break;

				case 83: // s
					scope.playerControls.move = null;
					break;

				case 68: // d
					scope.playerControls.turn = null;
					break;

				case 32: // space
					scope.playerControls.jump = false;
					break;

			}
		};

		var onMouseUp = function ( event ) {
			if(scope.controls.isLocked){
				scope.playerControls.attacking = true;
				scope.playerControls.attackMode = "normal";
			}
		};

		document.addEventListener( 'keydown', onKeyDown );
		document.addEventListener( 'keyup', onKeyUp );
		document.addEventListener( 'mouseup', onMouseUp );

		document.addEventListener( 'animation.nextActionStarted', function(ev){
			scope.playerControls.action = ev.nextActionCalled;
			scope.playerControls.freeze = false;
			scope.playerControls.attacking = false;
		});

	}

	updatePlayerAction(){
		let animSettings = this.engine.player.settings.animations;
		this.playerControls.action = 'idle';
		if(this.playerControls.attacking){
			switch(this.playerControls.attackMode){
				case 'normal':
					var newAttack = null, randomIndex;
					while(newAttack == this.playerControls.action || newAttack == null){
						randomIndex = Math.floor(Math.random() * animSettings.attack.length);
						console.log(randomIndex);
						newAttack = animSettings.attack[randomIndex];
					}
					this.playerControls.action = newAttack;
					break;
				case 'special':
					this.playerControls.action = 'special-attack';
					break;
			}

		} else if(this.playerControls.jump){
			this.playerControls.action = 'jump';
		} else if(this.playerControls.move) {
			this.playerControls.action = this.playerControls.status + "-forward";// + this.playerControls.move;
		} else if(this.playerControls.turn) {
			this.playerControls.action = 'run-forward';
		}
	}

	update(delta){

		if (this.cameraType == 'orbit'){

			this.controls.update();

		} else {

			let targetPos = new THREE.Vector3();
			this.engine.player.getWorldPosition(targetPos);
			targetPos.add(new THREE.Vector3(0, this.cameraControls.distanceFromFloor, 0));
			let lookatPos = new THREE.Vector3();
			this.engine.player.getWorldPosition(lookatPos);
			lookatPos.y += this.cameraControls.lookAtOffset;

			if(this.cameraType == 'follow') {

				let followCamera = this.engine.renderingManager.followCamera;
				followCamera.position.y = THREE.MathUtils.clamp(followCamera.position.y, targetPos.y, Number.POSITIVE_INFINITY);
				let newPos = targetPos.clone().add(new THREE.Vector3().subVectors(followCamera.position, targetPos).normalize().multiplyScalar(this.cameraControls.targetRadius));
				followCamera.position.set(newPos.x, newPos.y, newPos.z);
				followCamera.lookAt(lookatPos);

			} else if(this.cameraType == 'sight') {

				let sightCamera = this.engine.renderingManager.followCamera;
				this.controls.update();
				sightCamera.lookAt(lookatPos);

			}

		}

		//this.engine.UIManager.html.debugger.innerHTML += this.playerControls.action+"|"+this.engine.player.currentAction.name+"<br>";
		//this.engine.UIManager.html.debugger.innerHTML += this.playerControls.freeze+"<br>";

		if(!this.playerControls.freeze){

			this.updatePlayerAction();

			if(this.engine.player.currentAction.name != this.playerControls.action){
				let nextAction = null;
				if(this.playerControls.action == 'jump' || this.playerControls.action.indexOf('attack') != -1) {
					nextAction = (!this.playerControls.move || this.playerControls.attacking) ? 'idle' : this.playerControls.status + "-forward";// + this.playerControls.move;
					this.playerControls.freeze = true;
				}
				this.engine.assetManager.animationManager.swapAnimation( this.engine.player, this.playerControls.action, nextAction );
			}
		}

	}


}
