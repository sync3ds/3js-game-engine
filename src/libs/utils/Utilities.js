import * as THREE from 'three';

export function	quaternionWorldToLocal(worldQuaternion, parentMatrix) {
	let a = new THREE.Matrix4(),
		b = new THREE.Matrix4(),
		c = new THREE.Matrix4(),
		q = new THREE.Quaternion();
	a.makeRotationFromQuaternion(worldQuaternion);
	b.getInverse(parentMatrix);
	c.extractRotation(b);
	a.premultiply(c);
	q.setFromRotationMatrix(a);
	return q;
}

export function objIsEmpty(obj) {
	for(var key in obj) {
		if(obj.hasOwnProperty(key))
			return false;
	}
	return true;
}

export function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min; //Il max è escluso e il min è incluso
}

export function genCubeUrls( prefix, postfix ) {
	return [
		prefix + 'px' + postfix, prefix + 'nx' + postfix,
		prefix + 'py' + postfix, prefix + 'ny' + postfix,
		prefix + 'pz' + postfix, prefix + 'nz' + postfix
	];
}
