import { Quaternion } from 'three';
import firebase from "firebase/app";
import "firebase/database";
import * as Utils from '../libs/utils/Utilities.js';

export class SocketManager {

	constructor(engine) {
		this.engine = engine;
		this.isRoomAdmin = false;
		//this.engine.playerUID = Utils.getRandomInt(0, 1000000);

		const firebaseConfig = {
			apiKey: "AIzaSyAlO9Z_pb-39T6meLw5NW5ONYbOqHxSXkg",
			authDomain: "webgl-game-64e00.firebaseapp.com",
			databaseURL: "https://webgl-game-64e00-default-rtdb.europe-west1.firebasedatabase.app",
			projectId: "webgl-game-64e00",
			storageBucket: "webgl-game-64e00.appspot.com",
			messagingSenderId: "391433195866",
			appId: "1:391433195866:web:2df8bb7f39fb8d07306363"
		};
		firebase.initializeApp(firebaseConfig);
	}

	connect() {
		var scope = this;
		firebase.database().ref('users/' + this.engine.playerUID).set(this.engine.playerData)
			.then(function () { scope.onConnectionSucceed(); })
			.catch(function (error) { scope.onConnectionError(error); });
	}

	onConnectionSucceed() {
		console.log('Firebase synchronization succeeded!');

		var scope = this;

		firebase.database().ref('users').once('value').then(function (dataSnapshot) {
			if (dataSnapshot.numChildren() === 1) {
				scope.isRoomAdmin = true;
				firebase.database().ref('users/' + scope.engine.playerUID).update({ isRoomAdmin: true, userIndex: 0 });
			}
			scope.initListeners();
		});

		var myConnectionsRef = firebase.database().ref('users/' + this.engine.playerUID); // We're connected (or reconnected)
		var connectedRef = firebase.database().ref('.info/connected');
		connectedRef.on('value', function (snap) {
			if (snap.val() === true) {
				myConnectionsRef.onDisconnect().remove(); // When I disconnect, remove this device
			}
		});

	}

	onConnectionError(error) {
		console.log('Firebase synchronization failed!');
		console.log(error);
	}

	initListeners() {
		var scope = this;

		// Listens for users to join/leave the arena...
		this.engine.status = 'usersList';
		this.engine.UIManager.html.usersListWrap.classList.add('show');
		firebase.database().ref('users').on('child_added', function (childSnapshot, prevChildKey) {
			let user = childSnapshot.val();
			scope.updateUsersList();
		});
		firebase.database().ref('users').on('child_removed', function (childSnapshot) {
			let user = childSnapshot.val();
			scope.updateUsersList();
		});

		firebase.database().ref('users').on('child_changed', function (childSnapshot) {
			let user = childSnapshot.val();

			if (scope.engine.status != 'playing') {

				if (user.ready) {
					scope.engine.UIManager.setUserReady(user);
					scope.checkUserStatuses();
				}

			} else {

				if (user.username != scope.engine.playerUID) {
					let model = scope.engine.assetManager.characters.get(user.username);
					if (model) {
						scope.engine.physicsManager.updateOtherUserCharacter(model, user);
					}
				}

			}
		});
	}

	updateUsersList() {
		var scope = this;
		firebase.database().ref('users').once('value').then(function (dataSnapshot) {
			scope.engine.UIManager.resetUsersList();
			var userIndex = 0;
			dataSnapshot.forEach(function (childSnapshot) {
				let user = childSnapshot.val();
				if (!user.isRoomAdmin) userIndex++;
				scope.engine.UIManager.addUserToList(user, userIndex);
			});
		});
	}

	syncPlayer() {
		// THREE.Quaternion has underscore prefix for each component (_x, _y, _z, _w) but we want to send plain x,y,z,w on server
		let pos = { x: this.engine.player.position.x, y: this.engine.player.position.y, z: this.engine.player.position.z };
		let quat = { x: this.engine.player.quaternion.x, y: this.engine.player.quaternion.y, z: this.engine.player.quaternion.z, w: this.engine.player.quaternion.w };

		firebase.database().ref('users/' + this.engine.playerUID).update({
			pos: pos,
			quat: quat
		});
	}

	setPlayerReady() {
		this.engine.status = 'waitingRoom';
		firebase.database().ref('users/' + this.engine.playerUID + '/ready').set(true);
	}
	checkUserStatuses() {
		var ready = 0;
		this.engine.playersList.forEach(function (player, username) {
			if (player.ready) ready++;
		});
		if (ready == this.engine.playersList.size) {
			this.engine.initGame();
		}
	}

}
