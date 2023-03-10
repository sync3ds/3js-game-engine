import * as THREE from 'three';
import { EffectComposer } from '../libs/postprocessing/EffectComposer.js';
import { RenderPass } from '../libs/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../libs/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../libs/postprocessing/ShaderPass.js';
import { CopyShader } from '../libs/shaders/CopyShader.js';
import { FXAAShader } from '../libs/shaders/FXAAShader.js';
import { LightProbeGenerator } from '../libs/lights/LightProbeGenerator.js';
//import { Sky } from '../libs/effects/Sky.js';

// Sun azimuth value: 0.00 Sunrise | 0.25 Midday | 0.52 Sunset

export class RenderingManager {

	constructor(engine){
		this.engine = engine;
		this.ready = false;
	}

	init(){
		this.initDOM();
		this.initRenderer();
		this.initScene();
		this.initCamera();
		//this.initLights();
		//this.initPostProcessing();
	}

	initDOM(){
		this.divContainer = document.createElement('div');
		this.divContainer.setAttribute('id', 'stage');
		document.body.appendChild(this.divContainer);

		this.divBlocker = document.createElement('div');
		this.divBlocker.setAttribute('id', 'blocker');
		document.body.insertBefore(this.divBlocker, this.divContainer);

		this.engine.debugger = document.createElement('div');
		this.engine.debugger.setAttribute('id', 'debugger');
		document.body.insertBefore(this.engine.debugger, this.divBlocker);
		this.engine.UIManager.html.debugger = this.engine.debugger;

		let style = getComputedStyle(this.divContainer);
		this.divContainerSize = {
			w: parseInt(style.width),
			h: parseInt(style.height)
		};
	}

	initScene(){
		this.scene = new THREE.Scene();
	}

	initCamera(){
		this.camera = new THREE.PerspectiveCamera( 40, this.divContainerSize.w / this.divContainerSize.h, 0.1, 3000 );
		
		this.followCamera = new THREE.PerspectiveCamera( 60, this.divContainerSize.w / this.divContainerSize.h, 0.1, 3000 );
		var helper = new THREE.CameraHelper( this.followCamera );
		//this.scene.add(helper);
		
		this.debugCamera = new THREE.PerspectiveCamera( 40, this.divContainerSize.w / this.divContainerSize.h, 1, 500 );
		this.debugCamera.position.y = 100;
		this.debugCamera.lookAt(new THREE.Vector3(0,0,0));
	}

	initEnvironment(){
		this.scene.background = this.engine.levelBGMap;
	}

	initLights(){
		let sunSettings = this.engine.assetManager.sceneInfo.sunSettings;

		//let hemiLight = new THREE.HemisphereLight( sunSettings.skyColor, sunSettings.groundColor, sunSettings.intensity );
		//hemiLight.position.set( 0, 100, 0 );
		//this.scene.add( hemiLight );

		this.lightProbe = new THREE.LightProbe();
		this.lightProbe.copy( LightProbeGenerator.fromCubeTexture( this.engine.levelBGMap ) );
		this.lightProbe.intensity = sunSettings.intensity * 4;
		this.scene.add( this.lightProbe );

		let theta = Math.PI * ( sunSettings.inclination - 0.5 );
		let phi = 2 * Math.PI * ( sunSettings.azimuth - 0.5 );
		let frustum = 25;
		let totalDirLights = 3;
		this.sunPos = new THREE.Vector3();
		this.sunPos.x = Math.cos( phi );
		this.sunPos.y = Math.sin( phi ) * Math.sin( theta );
		this.sunPos.z = Math.sin( phi ) * Math.cos( theta );
		this.dirLightHelpers = [];
		for(let s=0; s<totalDirLights; s++){
			var directionalLight = new THREE.DirectionalLight( 0xffff9c, sunSettings.intensity / totalDirLights );
			directionalLight.position.copy(this.sunPos).multiplyScalar(100);
			directionalLight.position.x = this.sunPos.x + ((frustum * 2) * (s-1));
			directionalLight.castShadow = true;
			directionalLight.shadow.mapSize.width = 1024;
			directionalLight.shadow.mapSize.height = 1024;
			directionalLight.shadow.camera.near = 0.5;
			directionalLight.shadow.camera.far = 500;
			directionalLight.shadow.camera.left = -frustum;
			directionalLight.shadow.camera.right = frustum;
			directionalLight.shadow.camera.top = frustum;
			directionalLight.shadow.camera.bottom = -frustum;
			this.scene.add( directionalLight );

			directionalLight.target.position.x = directionalLight.position.x;
			this.scene.add( directionalLight.target );

			let directionalLightHelper = new THREE.DirectionalLightHelper( directionalLight, 2 );
			this.scene.add( directionalLightHelper );
			this.dirLightHelpers.push(directionalLightHelper);
		}

	}

	initRenderer(){

		this.renderer = new THREE.WebGLRenderer();
		this.renderer.setSize( this.divContainerSize.w, this.divContainerSize.h );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setClearColor( 0x000000 );
		this.renderer.autoClear = false;
		this.renderer.antialias = true;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		//this.renderer.outputEncoding = THREE.GammaEncoding; // sRGBEncoding / GammaEncoding
		//this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // CineonToneMapping / ReinhardToneMapping / ACESFilmicToneMapping

		this.renderer.toneMapping = THREE.NoToneMapping;
		this.renderer.outputEncoding = THREE.sRGBEncoding;

		this.renderer.toneMappingExposure = 0.5;
		this.renderer.powerPreference = "high-performance";
		this.renderer.failIfMajorPerformanceCaveat = true;
		this.renderer.logarithmicDepthBuffer = true;
		this.divContainer.appendChild( this.renderer.domElement );

		this.pmremGenerator = new THREE.PMREMGenerator( this.renderer );
		this.pmremGenerator.compileEquirectangularShader();
	}

	initPostProcessing(){
		let camera = this.engine.controlsManager.currentCamera;
		this.renderScene = new RenderPass( this.scene, camera );

		var bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ) );
		bloomPass.threshold = 0.7;
		bloomPass.strength = 0.2;
		bloomPass.radius = 0.5;

		let pixelRatio = this.renderer.getPixelRatio();
		var fxaaPass = new ShaderPass( FXAAShader );
		fxaaPass.material.uniforms[ 'resolution' ].value.x = 1 / ( this.divContainer.offsetWidth * pixelRatio );
		fxaaPass.material.uniforms[ 'resolution' ].value.y = 1 / ( this.divContainer.offsetHeight * pixelRatio );

		this.composer = new EffectComposer( this.renderer );
		this.composer.addPass( this.renderScene );
		this.composer.addPass( bloomPass );
		this.composer.addPass( fxaaPass );
	}
	
	swapCamera(camera){
		this.renderScene.camera = camera;
	}

	update(delta, elapsedTime) {

		for(let h=0; h<this.dirLightHelpers.length; h++){
			this.dirLightHelpers[h].update();
		}

		this.composer.render(delta);
		//this.renderer.clearDepth();
		//this.renderer.render(this.engine.UIManager.sceneOrtho, this.engine.UIManager.cameraOrtho);

	}

}
