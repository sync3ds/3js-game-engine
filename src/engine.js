import * as THREE from 'three';

import { Detector } from './libs/detector.js';

import { RenderingManager } from './managers/RenderingManager.js';
import { PhysicsManager } from './managers/PhysicsManager.js';
import { ControlsManager } from './managers/ControlsManager.js';
import { AssetManager } from './managers/AssetManager.js';
import { UIManager } from './managers/UIManager.js';
import { SocketManager } from './managers/SocketManager.js';

export class GameEngine {

	constructor(){

		// Detects webgl
		if ( ! Detector.webgl ) {
			Detector.addGetWebGLMessage();
			return;
		}

		this.clock = new THREE.Clock();
		this.playersList = new Map();
		this.player = null;
		this.status = 'off';
		this.debug = true;

		//

		this.playerData = {
			username: null,
			character: null,
			ready: false,
			isRoomAdmin: false,
			userIndex: 0,
			pos: { x: 0, y: 0, z: 0 },
			quat: { x: 0, y: 0, z: 0, w: 0 }
		}

		//

		this.physicsManager = new PhysicsManager(this);
		this.assetManager = new AssetManager( this );
		this.controlsManager = new ControlsManager(this);
		this.UIManager = new UIManager(this);
		this.renderingManager = new RenderingManager(this);
		this.socketManager = new SocketManager(this);

	}

	init( userSelection ){

		var scope = this;
		this.status = 'userSelection';
		this.place = userSelection.place;
		this.playerUID = userSelection.username;
		this.playerData.username = userSelection.username;
		this.playerData.character = userSelection.character;

		this.UIManager.init();

		fetch( 'json/assets.json' ).then( response => {

			return response.json();

		} ).then( json => {

			scope.gameAssetsInfo = json;
			scope.socketManager.connect();

		} );

		return this;

	}

	initGame(){
		this.status = 'playing';

		this.UIManager.html.usersListWrap.classList.remove("show");
		this.UIManager.html.loadingScreen.classList.add("show");

		window.addEventListener( 'resize', this.UIManager._onWindowResize.bind(this.UIManager), false );

		this.initManagers();
	}

	initManagers() {
		this._log("Initializing managers...");

		this.renderingManager.init();
		this.physicsManager.init();
		this.assetManager.init().then( () => {

			this.initObjects();
			this.initLevel();
			this.UIManager.init();
			this.controlsManager.init();
			this.renderingManager.initPostProcessing();
			this.UIManager.showGameInterface();

			this.animate();

		} );

	}

	initLevel(){
		this._log("Initializing level...");

		var geometry = new THREE.BoxBufferGeometry( 1, 3.3, 1 );
		var material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
		var cube = new THREE.Mesh( geometry, material );
		//this.renderingManager.scene.add( cube );
		cube.position.set(2,2.65,2);

		this.renderingManager.initLights();
		this.renderingManager.initEnvironment();
	}

	initObjects(){
		this._log("Initializing objects...");

		this.assetManager.objects.forEach(function(obj, username) {
			if(obj.status == 'hidden') obj.visible = false;
			this.renderingManager.scene.add(obj);
		}, this);
		this.assetManager.characters.forEach(function(obj, username) {
			if(obj.player === true) this.player = obj;
			if(obj.status == 'hidden') obj.visible = false;
			this.renderingManager.scene.add(obj);
		}, this);
	}

	animate(){

		window.requestAnimationFrame(this.animate.bind(this));

		const delta = this.clock.getDelta();

		this.UIManager.html.debugger.innerHTML = "";

		if(this.controlsManager.controls.isLocked || this.UIManager.preloading){
			this.physicsManager.update(delta);
			this.controlsManager.update(delta);
			this.assetManager.update(delta);
			this.UIManager.update(delta);
		}

		this.renderingManager.update(delta);

		if(this.UIManager.preloading) this.UIManager.hidePreloader();

	}

	_log(string){
		if(this.debug){
			console.log(string);
		}
	}

}
