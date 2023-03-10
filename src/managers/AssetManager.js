import * as THREE from 'three';
import * as Utils from '../libs/utils/Utilities.js';
import { AnimationManager } from './AnimationManager.js';
//import { SkeletonUtils } from '../libs/utils/SkeletonUtils.js';
import { GLTFLoader } from '../libs/loaders/GLTFLoader.js';
import { RGBELoader } from '../libs/loaders/RGBELoader.js';

/**
* Class for representing the global asset manager. It is responsible
* for loading and parsing all assets from the backend and provide
* the result in a series of maps.
**/
class AssetManager {

	/**
	* Constructs a new asset manager with the given values.
	*/
	constructor( engine ) {

		this.path = './';
		this.engine = engine;
		this.sceneInfo = false;
		this.modelsLoading = 0;

		this.textureLoadingManager = new THREE.LoadingManager();
		this.modelLoadingManager = new THREE.LoadingManager();
		this.animationManager = new AnimationManager(this);
		this.audioLoader = new THREE.AudioLoader( this.loadingManager );
		this.textureLoader = new THREE.TextureLoader( this.textureLoadingManager );
		this.cubeTextureLoader = new THREE.CubeTextureLoader( this.textureLoadingManager );
		this.rgbeLoader = new RGBELoader( this.textureLoadingManager ).setDataType( THREE.UnsignedByteType ).setPath( './textures/hdri/' );
		this.gltfLoader = new GLTFLoader( this.modelLoadingManager );
		//this.listener = new THREE.AudioListener();

		this.audios = new Map();
		this.objects = new Map();
		this.characters = new Map();
		
		

	}

	/**
	* Initializes the asset manager. All needed assets are prepared so they can be used by the game.
	*/
	init() {

		var scope = this;

		this.buildPlaceAssetsList();

		//

		this.textureLoadingManager.onLoad = function ( ) {
			console.log( 'Loading complete!');
			if(scope.engine.levelBGMap && scope.engine.hudTexture && scope.engine.levelEnvMap){
				scope.loadPlaceModels();
			}
		};
		this.textureLoadingManager.onProgress = function ( url, itemsLoaded, itemsTotal ) {
			//console.log( 'Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
		};

		return new Promise( ( resolve, reject ) => {
			if(!this.sceneInfo){
				reject('ERROR: Please specify a valid place to play!');
			} else {

				this.loadTextures();

				this.onLoad = () => {
					resolve();
				};

			}
		} );

	}

	buildPlaceAssetsList(){
		this.placeAssets = [];
		this.placePositions = [];
		for(let place of this.engine.gameAssetsInfo.places){
			if(place.uid == this.engine.place){
				this.sceneInfo = place.scene;
				this.placeAssets = place.objects;
				break;
			}
		}
	}
	buildCharactersAssetsList(){
		var scope = this;
		this.charactersAssets = [];
		if(this.placePositions.length == 0) this.placePositions.push({ pos: new THREE.Vector3(), rot: new THREE.Vector3() });
		this.engine.playersList.forEach(function(player, username) {
			for(let asset of scope.engine.gameAssetsInfo.characters){
				if(asset.uid == player.character){
					let newAsset = {};
					for(let key in asset) newAsset[key] = asset[key];
					let obj = scope.placePositions[player.userIndex];
					//obj.pos.y += 1;
					newAsset.startPos = obj.pos;
					newAsset.startRot = obj.rot;
					if(scope.engine.playerData.username == username) newAsset.player = true;
					newAsset.username = player.username;
					scope.charactersAssets.push(newAsset);
					break;
				}
			}
		});
	}


	/**
	* Loads all textures from the backend.
	*/
	loadTextures() {
		var scope = this;

		this.textureLoader.load( './textures/hud.png', function ( texture ) {
			scope.engine.hudTexture = texture;
			texture.dispose();
		});

		/*this.textureLoader.load( './textures/backgrounds/'+this.sceneInfo.backgroundMap, function ( texture ) {
			scope.engine.levelBGMap = texture;
			texture.dispose();
		});*/

		var urls = Utils.genCubeUrls( 'textures/backgrounds/'+this.sceneInfo.backgroundMap+'/', '.png' );
		this.cubeTextureLoader.load( urls, function ( cubeTexture ) {
			cubeTexture.encoding = THREE.sRGBEncoding;
			scope.engine.levelBGMap = cubeTexture;
		});
		this.rgbeLoader.load( this.sceneInfo.envMap, function ( texture ) {
			scope.engine.levelEnvMap = scope.engine.renderingManager.pmremGenerator.fromEquirectangular( texture ).texture;
			texture.dispose();
			scope.engine.renderingManager.pmremGenerator.dispose();
		});

	}

	/**
	* Loads all place models from the backend.
	*/
	loadPlaceModels() {

		if(this.modelsLoading < this.placeAssets.length){
			var assetRef = this.placeAssets[this.modelsLoading];
			this.loadModel(assetRef, true);
			this.modelsLoading++;
		} else {
			this.modelsLoading = 0;
			this.buildCharactersAssetsList();
			this.loadCharactersModels();
		}

	}

	/**
	* Loads all requested vehicles models from the backend.
	*/
	loadCharactersModels() {

		if(this.modelsLoading < this.charactersAssets.length){
			var assetRef = this.charactersAssets[this.modelsLoading];
			this.loadModel(assetRef, false);
			this.modelsLoading++;
		} else {
			this.onLoad();
		}

	}

	/**
	* Loads json data and 3D model
	*/
	loadModel(assetRef, isPlace){

		var scope = this;

		fetch( 'json/' + assetRef.reference + '.json' ).then( response => {

			return response.json();

		} ).then( json => {

			var scope = this;
			var asset = json;
			this.gltfLoader.load( this.path +'models/'+ asset.file, ( gltf ) => {
				let model = gltf.scene;
				model.animations = gltf.animations;
				model.player = (typeof(assetRef.player) != "undefined");
				model.visible = (typeof(assetRef.hide) != "undefined") ? !assetRef.hide : true;
				model.toRemove = [];
				model.traverse( function ( child ) {
					if(child.isMesh){

						child.castShadow = true;
						child.receiveShadow = true;

						if(asset.materialOverride){
							if(Array.isArray(child.material)){
								for(let material of child.material){
									scope.__setMaterial(material, asset.materialOverride);
								}
							} else {
								scope.__setMaterial(child.material, asset.materialOverride);
							}
						}

						scope.__setObjectAttributes(child);

					}

					if (child.hasOwnProperty('userData')) {
						if (child.userData.hasOwnProperty('data')) {
							if (child.userData.data === 'startPosition') {
								let obj = { pos: child.position, rot: child.rotation };
								scope.placePositions.push(obj);
								model.toRemove.push(child);
							}
						}
					}

				});

				if(model.toRemove.length > 0){
					for(let obj of model.toRemove) model.remove(obj);
				}

				// GLOBAL OBJECT PROPERTIES
				if(asset.objectOverride){
					for(let prop in asset.objectOverride){
						if(typeof(model[prop]) !== "undefined"){
							model[prop] = asset.objectOverride[prop];
						}
					}
				}

				model.settings = asset;
				model.name = assetRef.name;

				//if(model.settings.type != 'character' || model.player){
				model.position.copy(assetRef.startPos);
				var angle = new THREE.Euler( THREE.MathUtils.degToRad(assetRef.startRot.x), THREE.MathUtils.degToRad(assetRef.startRot.y), THREE.MathUtils.degToRad(assetRef.startRot.z) );
				model.setRotationFromEuler(angle);
				//}

				let size = new THREE.Vector3();
				let box = new THREE.Box3();
				box.setFromObject(model);
				box.getSize(size);
				model.size = size;

				scope.engine.physicsManager.setPhysics(model);

				if(model.settings.type == 'character'){
					scope.characters.set( assetRef.username, model );
				} else {
					scope.objects.set( assetRef.name, model );
				}

				model.updateMatrix();

				var axesHelper = new THREE.AxesHelper( 1 );
				//model.add( axesHelper );

				console.log(model);
				
				scope.animationManager.initAnimations(model);

				if(isPlace){
					scope.loadPlaceModels();
				} else {
					scope.loadCharactersModels();
				}

			} );

		} );
	}

	/**
	* Loads all audios from the backend.
	*
	* @return {AssetManager} A reference to this asset manager.
	*/
	_loadAudios() {

		return this;

	}



	/**
	* Loads the navigation mesh from the backend.
	*
	* @return {AssetManager} A reference to this asset manager.
	*/
	_loadNavMesh() {

		return this;

	}

	update(delta){
		var scope = this;

		this.characters.forEach(function(model, username) {
			if(model.mixer) model.mixer.update( delta );
		}, this);

	}

	__cleanBonesNames(skeleton, scope){
		for(let b=0; b<skeleton.bones.length; b++){
			if(skeleton.bones[b].name == 'ENDSITE'){
				skeleton.bones.splice(b, 1);
			}
		}
		for(let b=0; b<skeleton.bones.length; b++){
			for(let p=0; p<scope.possiblePrefix.length; p++){
				if(skeleton.bones[b].name.indexOf(scope.possiblePrefix[p]) != -1){
					skeleton.bones[b].name = skeleton.bones[b].name.split(scope.possiblePrefix[p]).join('');
				}
			}
		}
	}
	__cleanTracksNames(clip, scope){
		for(let t=0; t<clip.tracks.length; t++){
			for(let p=0; p<scope.possiblePrefix.length; p++){
				if(clip.tracks[t].name.indexOf(scope.possiblePrefix[p]) != -1){
					clip.tracks[t].name = clip.tracks[t].name.split(scope.possiblePrefix[p]).join('');
				}
			}
		}
	}
	__setMaterial(material, overrides){
		for(let m in overrides){
			material[m] = overrides[m];
		}
		if(material.hasOwnProperty('userData')){
			for(let property in material.userData){
				switch(property){
					case 'alphaMap':
						let loader = new THREE.TextureLoader()
						.load( './textures/alpha/'+material.userData.alphaMap, function ( texture ) {
							material.premultipliedAlpha = true;
							material.transparent = true;
							material.alphaMap = texture;
						});
						break;
					case 'envMap':
						material.envMap = this.engine.levelEnvMap;
						break;
					default:
						material[property] = material.userData[property];
						break;
				}
			}
		}
	}
	__setObjectAttributes(object){
		if(object.hasOwnProperty('userData')) {
			for(let prop in object.userData){
				if(typeof(object[prop]) !== "undefined"){
					let val = (object.userData[prop] == "false") ? false : ((object.userData[prop] == "true") ? true : object.userData[prop]);
					object[prop] = val;
				}
			}
		}
		object.needsUpdate = true;
	}

	onLoad(){ return false; }

}

export { AssetManager };
