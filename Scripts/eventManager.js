EM = {
	events: {},
	on: function(eventName, handler, context) { // add event handlers
		if (eventName && handler && context)
		{
			if(!this.events[eventName]) {
				this.events[eventName] = [];
			}
			var guid = this.guid();
			this.events[eventName][guid] = { action: handler, context: context || this };

			return guid; // return the guid so the handler can be retrieved later
		}
		else
		{
			console.info('An event name, a valid function, and the function\'s context are required');
			return undefined;
		}
	},
	emit: function() {
		var args = Array.prototype.slice.call(arguments);
		if(args.length == 0) {
			console.info('At least one argument must be passed to emit.');
			return false;
		}
		else if(this.events[args[0]]) {
			var eventName = args[0];
			var handler;
			for(var item in this.events[eventName]) {
				handler = this.events[eventName][item];
				try
				{
					handler.action.apply(handler.context || this, args.slice(1, args.length));
				}
				catch(e)
				{
					EM.remove(eventName, item);
					console.info('Event Name:', eventName, 'ID:', item, 'was deleted due to an error:', e.message);
				}
			}
			return true;
		}
		else {
			console.info('No event by the name', args[0], 'found.');
		}
	},
	remove: function(eventName, guid) {
		if(eventName || guid) {
			console.info('An event name and an id are required to delete a handler.')
			return false;
		}
		if(this.events[eventName] && this.events[eventName][guid]) {
			delete this.events[eventName][guid];
			return true;
		}
		else {
			console.info('No handler found for', eventName, guid);
			return false;
		}
	},
	guid: function() { // generates random guid
		var result=[];
		for(var i=0; i<16; i++) {
			result.push(Math.floor(Math.random()*16).toString(16).toUpperCase());
		}
		return result.join('');
	}
};