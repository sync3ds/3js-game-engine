const loadScriptAsync = (url, doneCallback) => {
	var tag = document.createElement('script');
	tag.onload = () => {
		doneCallback()
	};
	tag.onerror = () => {
		throw new Error('failed to load ' + url)
	};
	tag.async = true;
	tag.src = url;
	document.head.appendChild(tag);
}

export let PhysicsLoader = (path, callback) => {
	loadScriptAsync(`${path}/cannon-es.js`, () => {
		Ammo().then(() => {
			callback()
		})
	});
}
