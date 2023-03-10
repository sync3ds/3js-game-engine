import * as THREE from 'three';
import { Stats } from '../libs/stats.module.js';

/**
* Used to manage the state of the user interface.
*
*/
class UIManager {

	/**
	* Constructs a new asset manager with the given values.
	*/
	constructor(engine) {
		this.engine = engine;
		this.preloading = true;
		this.html = {
			usersListWrap: document.getElementById( 'users-list-wrap'),
			usersList: document.getElementById( 'users-list' ),
			usersWaiting: document.getElementById( 'waiting' ),
			loadingScreen: document.getElementById( 'loading-screen' ),
			btnPlay: document.getElementById( 'play-game' ),
		};
	}

	init() {

		var scope = this;

		this.html.btnPlay.addEventListener('click', function(evt){
			evt.preventDefault();
			scope.engine.socketManager.setPlayerReady();
			scope.html.usersWaiting.classList.add('show');
		});

	}

	resetUsersList(){
		this.html.usersList.innerHTML = '';
		this.engine.playersList.clear();
	}
	addUserToList(user, userIndex){
		user.userIndex = (user.isRoomAdmin) ? 0 : userIndex;
		this.engine.playersList.set(user.username, user);
		let txt = (user.isRoomAdmin) ? 'ADMIN - ' : '';
		txt += user.username+" ("+user.character+")";
		let liNode = document.createElement('li');
		let txtNode = document.createTextNode(txt);
		liNode.setAttribute('id', 'user-'+user.username);
		liNode.appendChild(txtNode);
		this.html.usersList.prepend(liNode);
	}
	setUserReady(user){
		var player = this.engine.playersList.get(user.username);
		player.ready = true;
		document.getElementById('user-'+user.username).textContent += " - READY!";
	}

	showGameInterface(){
		this.initStats();
		this.initHUD();
	}

	hidePreloader(){
		this.html.loadingScreen.classList.add('fade-out');
		this.preloading = false;
	}

	initStats(){
		this.stats = Stats();
		document.body.appendChild(this.stats.dom);
		this.stats.begin();
	}
	initHUD(){
		var width = this.engine.renderingManager.divContainerSize.w;
		var height = this.engine.renderingManager.divContainerSize.h;

		this.sceneOrtho = new THREE.Scene();
		this.cameraOrtho = new THREE.OrthographicCamera( - width / 2, width / 2, height / 2, - height / 2, 1, 10 );
		this.cameraOrtho.position.z = 10;

		var material = new THREE.SpriteMaterial( { map: this.engine.hudTexture } );
		this.hud = new THREE.Sprite( material );
		this.hud.center.set( 0.5, 0.5 );
		this.hud.scale.set( material.map.image.width, material.map.image.height, 1 );
		//this.sceneOrtho.add( this.hud );

		/*var material = new THREE.SpriteMaterial( { map: this.engine.crosshair1Texture } );
		this.crosshair1 = new THREE.Sprite( material );
		this.crosshair1.center.set( 0.5, 0.5 );
		this.crosshair1.scale.set( material.map.image.width, material.map.image.height, 1 );
		this.sceneOrtho.add( this.crosshair1 );*/
	}

	update(delta){
		this.stats.update();

		//this.html.debugger.innerHTML += this.engine.playerUID+"<br>";
		//this.html.debugger.innerHTML += this.engine.renderingManager.camera.position.x+"|"+this.engine.renderingManager.camera.position.y+"|"+this.engine.renderingManager.camera.position.z+"<br>";
		//this.html.debugger.innerHTML += this.engine.physicsManager.playerVehicle.isResetting;

		this.ready = true;
	}

	_onWindowResize() {

		const width = this.engine.renderingManager.divContainerSize.w;
		const height = this.engine.renderingManager.divContainerSize.h;

		this.engine.renderingManager.camera.aspect = width / height;
		this.engine.renderingManager.camera.updateProjectionMatrix();
		this.engine.renderingManager.followCamera.aspect = width / height;
		this.engine.renderingManager.followCamera.updateProjectionMatrix();

		if(this.cameraOrtho){
			this.cameraOrtho.left = - width / 2;
			this.cameraOrtho.right = width / 2;
			this.cameraOrtho.top = height / 2;
			this.cameraOrtho.bottom = - height / 2;
			this.cameraOrtho.updateProjectionMatrix();
		}

		this.engine.renderingManager.renderer.setSize( width, height );
		this.engine.renderingManager.composer.setSize( width, height );

		let pixelRatio = this.engine.renderingManager.renderer.getPixelRatio();
		let container = this.engine.renderingManager.divContainer;
		this.engine.renderingManager.fxaaPass.material.uniforms[ 'resolution' ].value.x = 1 / ( container.offsetWidth * pixelRatio );
		this.engine.renderingManager.fxaaPass.material.uniforms[ 'resolution' ].value.y = 1 / ( container.offsetHeight * pixelRatio );

	}


}

export { UIManager };
