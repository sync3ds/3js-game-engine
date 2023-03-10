import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CannonDebugRenderer } from '../libs/utils/cannonDebugRenderer.js';
import * as CannonUtils from '../libs/utils/cannonUtils.js';
import * as Utils from '../libs/utils/Utilities.js';
import { threeToCannon } from 'three-to-cannon';

export class PhysicsManager {

	constructor(engine){

		this.engine = engine;
		this.debugPhysics = true;
		this.collisionObjects = []; // Used by physicsManager for camera collisions
		this.globalDamping = 0.05;
		this.collisionGroups = {
			Default: 1,
			Characters: 2,
			TrimeshColliders: 4
		};
	}

	init() {

		this.initPhysics();

	}

	initPhysics(resolve) {
		this.world = new CANNON.World();
		this.world.broadphase = new CANNON.SAPBroadphase(this.world);
		this.world.gravity.set(0, -9.8, 0);
		this.world.solver.iterations = 10; // A higher number will increase precision and stability, but also compromise performance.
		this.world.defaultContactMaterial.friction = 0;

		this.groundMaterial = new CANNON.Material({ name: 'groundMaterial', color: 0xffffff });
		this.characterMaterial = new CANNON.Material({ name: 'characterMaterial', color: 0x000000 });

		this.cannonDebugRenderer = new CannonDebugRenderer(this.engine.renderingManager.scene, this.world);
	}

	initControlCamera(camera){
		this.cameraObject = camera;
		this.raycaster = new THREE.Raycaster();
	}

	createStaticObject(model) {
		if(typeof(model.collisionShapes) != "undefined"){
			for(let obj of model.collisionShapes){
				this._fixShapeParams(obj);
				var pos = new CANNON.Vec3(obj.pos.x, obj.pos.y, obj.pos.z);
				var quat = new CANNON.Quaternion(obj.quat.x, obj.quat.y, obj.quat.z, obj.quat.w);
				var staticBody = new CANNON.Body({ mass: 0 });
				staticBody.material = this.groundMaterial;
				staticBody.addShape(obj.shape, pos, quat);
				this.world.addBody(staticBody);
			}
			
		}
	}

	createDynamicObject(model) {
		if(typeof(model.collisionShapes) != "undefined"){
			var obj = model.collisionShapes[0];
			var pos = new CANNON.Vec3(obj.pos.x, obj.pos.y, obj.pos.z);
			var quat = new CANNON.Quaternion(obj.quat.x, obj.quat.y, obj.quat.z, obj.quat.w);
			model.rotationAngle = 0;
			model.dynamicBody = new CANNON.Body({ mass: model.settings.physics.mass });
			model.dynamicBody.material = this.characterMaterial;
			model.dynamicBody.linearDamping = model.dynamicBody.angularDamping = this.globalDamping;
			if(Array.isArray(obj.shape)){ // Compound shape
				for(let shapeInfo of obj.shape){
					model.dynamicBody.addShape(shapeInfo.shape, shapeInfo.pos, shapeInfo.quat);
				}
			} else {
				model.dynamicBody.addShape(obj.shape, pos, quat);
			}
			this.world.addBody(model.dynamicBody);
		}
	}

	setPhysics(model){
		var scope = this;
		model.offset = 0;
		model.toRemove = [];
		model.collisionShapes = [];
		model.traverse( function ( child ) {

			if (child.hasOwnProperty('userData')) {
				if (child.userData.hasOwnProperty('data')) {

					if (child.userData.data === 'collision'){
						let params = scope._getShapeParams(child.userData.shape, child);
						let shape = scope._createCollisionShape(child.userData.shape, params, child);
						let obj = {
							name: child.name,
							shapeType: child.userData.shape,
							shape: shape,
							pos: child.position.clone(),
							quat: child.quaternion.clone(),
							materialType: (child.userData.hasOwnProperty('materialType')) ? child.userData.materialType : 'standard'
						};
						model.collisionShapes.push(obj);

						if(!child.userData.hasOwnProperty('preserveMesh')) model.toRemove.push(child);
						
						scope.collisionObjects.push(child);

					}

				}
			}

		});

		if(model.toRemove.length > 0){
			for(let obj of model.toRemove){
				obj.visible = false;
				//model.remove(obj);
			}
		}

		if(model.settings.type == 'static'){
			this.createStaticObject(model);
		} else {
			this.createDynamicObject(model);
		}

	}

	update(delta) {

		let timeStep = 1 / 60;
		this.world.step(timeStep, delta, 20);

		this.updateObjects();

		if(this.debugPhysics) this.cannonDebugRenderer.update();

	}

	updateObjects() {

		this.updatePlayerCharacter();

		let targetPos = new THREE.Vector3(
			this.engine.player.dynamicBody.interpolatedPosition.x,
			this.engine.player.dynamicBody.interpolatedPosition.y,
			this.engine.player.dynamicBody.interpolatedPosition.z
		);
		let targetQuat = new THREE.Quaternion(
			this.engine.player.dynamicBody.interpolatedQuaternion.x,
			this.engine.player.dynamicBody.interpolatedQuaternion.y,
			this.engine.player.dynamicBody.interpolatedQuaternion.z,
			this.engine.player.dynamicBody.interpolatedQuaternion.w
		);
		this.engine.player.position.copy(targetPos);
		this.engine.player.quaternion.slerp(targetQuat, 0.1);

		//

		//this.engine.socketManager.syncPlayer();

		//

		// Objects
		/*for(let o=0; o<this.objects.length; o++){
			var mesh = this.objects[o];
			var body = mesh.body;
			mesh.position.copy(body.interpolatedPosition);
			if (body.quaternion) {
				mesh.quaternion.copy(body.interpolatedQuaternion);
			}
		}*/

		//this.engine.UIManager.html.debugger.innerHTML += this.engine.player.position.x.toFixed(1)+"|"+this.engine.player.position.y.toFixed(1)+"|"+this.engine.player.position.z.toFixed(1)+"<br>";

	}

	updatePlayerCharacter(){
		let controls = this.engine.controlsManager.playerControls;
		let speed = this.engine.player.settings.physics.speed;
		let rotSpeed = THREE.MathUtils.degToRad(this.engine.player.settings.physics.rotationalSpeed);
		let direction = new THREE.Vector3(0, 0, 1);
		let scalar = speed;
		let cameraAngle = this.engine.controlsManager.controls.getAzimuthalAngle();
		let rotationAngle;

		if(!controls.attacking){

			let angle = (!controls.move) ? Math.PI/2 : Math.PI/4;
			if(controls.turn == 'left') {
				rotationAngle = (controls.move == 'backward') ? cameraAngle - angle : cameraAngle + Math.PI + angle;
			} else if(controls.turn == 'right') {
				rotationAngle = (controls.move == 'backward') ? cameraAngle + angle : cameraAngle + Math.PI - angle;
			} else {
				if(controls.move){
					rotationAngle = (controls.move == 'backward') ? cameraAngle : cameraAngle + Math.PI;
				} else {
					scalar = 0;
				}
			}
			if(controls.status == 'run' && scalar) scalar *= 3;
			
		} else {
			scalar = 0;
		}

		if(rotationAngle) this.engine.player.rotationAngle = rotationAngle;
		this.engine.player.dynamicBody.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.engine.player.rotationAngle);
		direction.applyAxisAngle(new THREE.Vector3( 0, 1, 0 ), this.engine.player.rotationAngle).multiplyScalar(scalar);
		this.engine.player.dynamicBody.velocity.x = direction.x;
		this.engine.player.dynamicBody.velocity.z = direction.z;

		if(controls.jump && !controls.freeze){
			let physicsForce = new CANNON.Vec3(0, this.engine.player.settings.physics.jumpForce, 0);
			this.engine.player.dynamicBody.applyLocalImpulse(physicsForce, new CANNON.Vec3(0, 0, 0));
		}

		//this.engine.UIManager.html.debugger.innerHTML += "velocity: "+this.engine.player.dynamicBody.velocity.x.toFixed(1)+"|"+this.engine.player.dynamicBody.velocity.y.toFixed(1)+"|"+this.engine.player.dynamicBody.velocity.z.toFixed(1)+"<br>";
		//this.engine.UIManager.html.debugger.innerHTML += "scalar: "+scalar+"<br>";

	}

	updateCamera(direction){
		let falloff = 0;
		let far = this.engine.player.position.distanceTo(this.cameraObject.position) + falloff;
		this.raycaster.set(this.engine.player.position, direction.normalize(), 0, far);

		var intersects = this.raycaster.intersectObjects( this.collisionObjects, false );
		if(intersects.length > 0 && intersects[0].distance <= far){
			this.engine.controlsManager.controls.collidingPoint = intersects[0];
		} else {
			this.engine.controlsManager.controls.collidingPoint = null;
		}
	}

	updateOtherUserCharacter(model, user){
		model.dynamicBody.position.copy(user.pos);
		model.dynamicBody.quaternion.copy(user.quat);
		model.position.copy(user.pos);
		model.quaternion.copy(user.quat);
	}

	_createCollisionShape(shape, params, object) {
		let collisionShape;
		switch (shape) {
			case 'plane':
				collisionShape = new CANNON.Box(new CANNON.Vec3(params.width / 2, 0.1, params.height / 2));
				collisionShape.collisionFilterMask = ~this.collisionGroups.TrimeshColliders;
				break;
			case 'box':
				collisionShape = new CANNON.Box(new CANNON.Vec3(params.width / 2, params.height / 2, params.depth / 2));
				collisionShape.collisionFilterMask = ~this.collisionGroups.TrimeshColliders;
				break;
			case 'sphere':
				collisionShape = new CANNON.Sphere(params.radius / 2);
				break;
			case 'cylinder':
				collisionShape = new CANNON.Cylinder(params.radiusTop, params.radiusBottom, params.height, params.segments);
				break;
			case 'trimesh':
				if(object.geometry.isBufferGeometry) object.geometry = new THREE.Geometry().fromBufferGeometry(object.geometry);
				collisionShape = threeToCannon(object, {type: threeToCannon.Type.MESH});
				break;
			default:
				//collisionShape = CannonUtils.createTrimesh(object.geometry);
				break;
		}
		return collisionShape;
	}
	_getShapeParams(shape, object){
		let params, size = new THREE.Vector3();
		let origQuat = object.quaternion.clone();
		object.quaternion.set(0, 0, 0, 0);
		var box = new THREE.Box3();
		box.setFromObject(object);
		box.getSize(size);
		object.quaternion.copy(origQuat);
		switch(shape){
			case 'plane':
				params = { width: size.x, height: size.z };
				break;
			case 'box':
				params = { width: size.x, height: size.y, depth: size.z };
				break;
			case 'sphere':
				params = { radius: size.x };
				break;
			case 'cylinder':
				params = { radiusTop: size.x/2, radiusBottom: size.x/2, height: size.y, segments: 12 };
				break;
			case 'torus':
				params = { outerRadius: size.x/2, innerRadius: size.y/2, radialSegments: 4, tubularSegments: 16 };
				break;
		}
		return params;
	}

	_fixShapeParams(obj){
		switch(obj.shapeType){
			case 'plane':
				break;
			case 'cylinder':
				let tmpQuat = new THREE.Quaternion().setFromAxisAngle (new THREE.Vector3(1, 0, 0), Math.PI/2 );
				obj.quat.multiply(tmpQuat);
			default:
				//obj.pos.y += 0.1;
		}

	}

}
