Module = function () { }

Module.prototype.settings = {};

Module.prototype.elementMap = {};

Module.prototype.init = function (moduleId, context) {

	moduleId = moduleId || 'body';
	this.context = context || {};

	var $module;

	if (typeof moduleId == 'string') {
		$module = $(moduleId, document);
	}
	else {
		$module = moduleId;
	}

	if (!$module.length) {
		console.info(moduleId + ' - Module container not found', moduleId);
		return;
	}

	this.$module = $module;
	this.moduleId = this.$module.attr('id');

	Module.registerModule(this.moduleId, this);

	this.$module.data('moduleInstance', this);

	if (!this.moduleId) {
		this.moduleId = this.getUID();
		this.$module.attr('id', this.moduleId);
	}

	this.$elements = {};

	this.initPageLevelEvents();

	this.attachEvents();

	if (this.onRemove) {
		this.$module.on('remove', $.proxy(this.onRemove, this));
	}

	this.initModule ? this.initModule() : null;
}

Module._UID = 0;

Module.prototype.getUID = function (prefix) {
	return 'module_' + (prefix || '') + Module._UID++;
}

Module.prototype.streaming = null;

Module.prototype.initPageLevelEvents = function () {
	if (this.settings.IsPageLevel) {
		// Page level events - like symbol search init

		//new SiteHeaderModule().init('#SiteHeaderModule');

		//this.$el('section.equalHeights, div.equalHeights').equalHeights();
	}
}

Module.prototype.attachEvents = function () {
	this.$module.on('click.module', '[data-clickaction]', $.proxy(this.handleAction, this));
	this.$module.on('change.module', '[data-changeaction]', $.proxy(this.handleAction, this));
	this.$module.on('keyup.module', '[data-keyupaction]', $.proxy(this.handleAction, this));
	this.$module.on('keydown.module', '[data-keydownaction]', $.proxy(this.handleAction, this));
	this.$module.on('keypress.module', '[data-keydownaction]', $.proxy(this.handleAction, this));
	this.$module.on('focusin.module', '[data-focusinaction]', $.proxy(this.handleAction, this));
	this.$module.on('focusout.module', '[data-focusoutaction]', $.proxy(this.handleAction, this));
}

// Broken into its own method as adding this by default creates a lot of uncaptured events and jQuery processing.  Call this manaully within your module's initModule()
Module.prototype.attachEventsHover = function () {
	this.$module.on('mouseenter.module mouseleave.module', '[data-hoveraction]', $.proxy(this.handleAction, this));
}

Module.prototype.handleAction = function (e) {
	//console.log(e);
	var type = e.type,
		$el = $(e.currentTarget),
		tag = $el[0].tagName.toLowerCase(),
		action = $el.attr('data-' + type + 'action'),
		actionValue;

	if (/mouse(enter|leave)/.test(type)) {
		action = $el.attr('data-hoveraction')
	}

	// Cancel event for non-input elements (like a link's href)
	if (tag !== 'input' && type !== 'keydown') {
		e.preventDefault();
	}

	if (/(select|input)/.test(tag)) {
		if ($el.attr("type") == "checkbox") {
			actionValue = $el.is(":checked") ? true : false;
		} else {
			actionValue = $el.val();
		}
	}
	else {
		actionValue = $el.data('actionvalue');
	}


	e.stopPropagation();
	$.event.trigger({type:'clearMenus'});

	if (this['action_' + action]) {
		this['action_' + action]($el, actionValue, e);
	}
	else {
		console.info(this, this.moduleId, this.$module, 'Module:handleAction', action, 'action not found');
	}

}


// Consistent handling of "more" links
Module.prototype.action_readMoreClicked = function ($el, val) {
	$el.prev().addClass("none");
	$el.next().removeClass("none");
	$el.addClass("none");
	$el.nextAll(".readLess").removeClass("none");
}

Module.prototype.action_readLessClicked = function ($el, val) {
	$el	.addClass('none')
		.prev().addClass('none') // 'more' text
		.prev().removeClass('none') // read more link
		.prev().removeClass('none') // 'less' text
}

Module.prototype.clickElement = function (action, val) {

	if (action && val) {
		this.$el('[data-clickaction="' + action + '"][data-actionvalue="' + val + '"]').trigger('click');
	}
	else {
		this.$el('[data-clickaction="' + action + '"]').trigger('click');
	}

}

Module.prototype.openPDF = function (e) {

	e.preventDefault();
	e.stopPropagation();

	var $el = $(e.currentTarget);

	if ($el.data('clickaction') == 'publicLoginLinkClicked') {
		return;
	}

	var href = $el.attr('href');

	href += "&title=" + $el.text();

	window.open(href);

}

Module.prototype.ajax = function (oArgs) {
	//this.updateKeepAlive() // Seems to be an artifact from the pershing site (keep session alive in iframe)

	// resolve path
	// override onload with $.proxy and context
	// any other preprocessing
	// oArgs.url = oArgs.url.resolveUrl();

	//
	var defaults = { type: "POST", success: "contentLoaded", contentType: 'application/json; charset=utf-8', dataType: "json" }
	oArgs = $.extend({}, defaults, oArgs);

	if (typeof oArgs.success == "string") {
		oArgs.success = $.proxy(this[oArgs.success], this);
	}

	if (typeof oArgs.error == "string") {
		oArgs.error = $.proxy(this[oArgs.error], this);
	}

	if (typeof oArgs.beforeSend == "string") {
		oArgs.beforeSend = $.proxy(this[oArgs.beforeSend], this);
	}

	if (typeof oArgs.complete == "string") {
		oArgs.complete = $.proxy(this[oArgs.complete], this);
	}

	oArgs.successOrig = oArgs.success;
	oArgs.success = success;
	oArgs.url = oArgs.url.resolveUrl();
	oArgs.data = JSON.stringify(oArgs.data);

	// Wrapper so original arguments along with other values from the Ajax response can be packaged up
	var self = this;
	function success(data) {
		oArgs.successOrig(data, oArgs);
		// self.resizeParentFrame(); // Seems to be an artifact from the pershing site (resize iframe)
	}

	//EM.emit('userActivity');

	return $.ajax(oArgs);
}

// Generic ajax handler that just populates the content container and hides loading
Module.prototype.contentLoaded = function (data, oArgs) {
	this.$el('> div.content').html(data.html);
}


/* 
Easy, on demand access to elements with caching for subsequnt lookups
Utilizes "elementMap" if it exists on the instance:

ModuleClass.prototype.elementMap = {
'contents':'div.contents'
}

Or you may pass a custom selector
*/
Module.prototype.$el = function (name, retrieveFresh) {

	if (!this.$elements[name] || retrieveFresh) {
		this.$elements[name] = $(this.elementMap[name] || name, this.$module[0]);
	}

	return this.$elements[name];
}


// Get data-attribute of of the main container
Module.prototype.getData = function (name) {
	return this.$module.data(name) || null;
}


// Static methods used for cross module communication
/*
Module.fireModuleMethod("OverviewModule", "reload")

*/
Module._module_map = {};
Module.registerModule = function (moduleId, instance) {
	Module._module_map[moduleId] = instance;
}

Module.getModule = function (moduleId) {
	return Module._module_map[moduleId] || null;
}

Module.fireModuleMethod = function (moduleId, method, param1, param2, param3, param4, param5) {
	var module = Module.getModule(moduleId);

	if (module && module[method]) {
		return module[method](param1, param2, param3, param4, param5);
	}
}