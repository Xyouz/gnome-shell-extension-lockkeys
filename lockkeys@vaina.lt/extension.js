const St = imports.gi.St;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext.domain('lockkeys');
const _ = Gettext.gettext;

const Panel = imports.ui.panel;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;

const Keymap = Gdk.Keymap.get_default();


const ExtensionUtils = imports.misc.extensionUtils;
const Meta = ExtensionUtils.getCurrentExtension();
const Utils = Meta.imports.utils;


const STYLE = 'style';
const STYLE_HIGHLIGHT = 'highlight';
const STYLE_SHOWHIDE = 'show-hide';
const NOTIFICATIONS = 'notifications';
const SHOW_NUMLOCK = 'show-numlock';
const SHOW_CAPSLOCK = 'show-capslock';

let indicator;

function main() {
	init();
	enable();
}

function init() {
	Utils.initTranslations("lockkeys");
}

function enable() {
	indicator = new LockKeysIndicator();	
	Main.panel.addToStatusArea('lockkeys', indicator, 2);
	indicator.setActive(true);
}

function disable() {
	indicator.setActive(false);
	indicator.destroy();
}

const LockKeysIndicator = new Lang.Class({
	Name: 'LockKeysIndicator',
	Extends: PanelMenu.Button,

	_getCustIcon: function(icon_name) {
		let gicon = Gio.icon_new_for_string( Meta.dir.get_child('icons').get_path() + "/" + icon_name + ".svg" );
		return gicon;
	},

	_init: function() {
		this.parent(0.0, "LockKeysIndicator");

		// For highlight to work properly you have to use themed
		// icons. Fortunately we can add our directory to the search path.
		Gtk.IconTheme.get_default().append_search_path(Meta.dir.get_child('icons').get_path());

		this.numIcon = new St.Icon({gicon: this._getCustIcon("numlock-enabled-symbolic"),
			style_class: 'system-status-icon'});
		this.capsIcon = new St.Icon({gicon: this._getCustIcon("capslock-enabled-symbolic"),
			style_class: 'system-status-icon'});

		let layoutManager = new St.BoxLayout({vertical: false,
			style_class: 'lockkeys-container'});
		layoutManager.add_child(this.numIcon);
		layoutManager.add_child(this.capsIcon);

		this.actor.add_child(layoutManager);

		this.numMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Num Lock"), false, { reactive: false });
		this.menu.addMenuItem(this.numMenuItem);

		this.capsMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Caps Lock"), false, { reactive: false });
		this.menu.addMenuItem(this.capsMenuItem);

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.settingsMenuItem = new PopupMenu.PopupMenuItem(_("Settings"));
		this.settingsMenuItem.connect('activate', Lang.bind(this, this._handleSettingsMenuItem));
		this.menu.addMenuItem(this.settingsMenuItem);
		
		this.config = new Configuration();
		this.indicatorStyle = new HighlightIndicator(this);
	},

	setActive: function(enabled) {
		if (enabled) {
			this._keyboardStateChangedId = Keymap.connect('state-changed', Lang.bind(this, this._handleStateChange));
			this._settingsChangeId = this.config.settings.connect('changed::' + STYLE, Lang.bind(this, this._handleSettingsChange));
			this._handleSettingsChange();
		} else {
			Keymap.disconnect(this._keyboardStateChangedId);
			this.config.settings.disconnect(this._settingsChangeId);
		}
	}, 

	_handleSettingsMenuItem: function(actor, event) {
		imports.misc.util.spawn(['gnome-shell-extension-prefs', 'lockkeys@vaina.lt']);
	},
	
	_handleSettingsChange: function(actor, event) {
		if (this.config.isShowHideStyle())
			this.indicatorStyle = new ShowhideIndicator(this);
		else
			this.indicatorStyle = new HighlightIndicator(this);
		this._updateState();
	},

	_handleStateChange: function(actor, event) {
		if (this.numlock_state != this._getNumlockState()) {
			let notification_text = _("Num Lock") + ' ' + this._getStateText(this._getNumlockState());
			if (this.config.isShowNotifications() && this.config.isShowNumLock()) {
				this._showNotification(notification_text, "numlock-enabled");
			}
		}
		if (this.capslock_state != this._getCapslockState()) {
			let notification_text = _("Caps Lock") + ' ' + this._getStateText(this._getCapslockState());
			if (this.config.isShowNotifications() && this.config.isShowCapsLock()) {
				this._showNotification(notification_text, "capslock-enabled");
			}
		}
		this._updateState();
	},

	_updateState: function() {
		this.numlock_state = this._getNumlockState();
		this.capslock_state = this._getCapslockState();

		this.indicatorStyle.displayState(this.numlock_state, this.capslock_state);
		this.numMenuItem.setToggleState(this.numlock_state);
		this.capsMenuItem.setToggleState(this.capslock_state);
	},

	_showNotification: function(notification_text, icon_name) {
		this._prepareSource(icon_name);

		let notification = null;
		if (this._source.notifications.length == 0) {
			notification = new MessageTray.Notification(this._source, notification_text);
			notification.setTransient(true);
			notification.setResident(false);
		} else {
			notification = this._source.notifications[0];
			notification.update(notification_text, null, { clear: true });
		}

		this._source.notify(notification);
	},

	_prepareSource: function(icon_name) {
		if (this._source == null) {
			this._source = new MessageTray.SystemNotificationSource();
			this._source.createNotificationIcon = function() {
				return new St.Icon({ icon_name: icon_name,
					icon_type: St.IconType.SYMBOLIC,
					icon_size: this.ICON_SIZE });
			};
			this._source.connect('destroy', Lang.bind(this,
					function() {
				this._source = null;
			}));
			Main.messageTray.add(this._source);
		}
	},

	_getStateText: function(state) {
		return state ? _("On") : _("Off");
	},

	_getNumlockState: function() {
		return Keymap.get_num_lock_state();
	},

	_getCapslockState: function() {
		return Keymap.get_caps_lock_state();
	}
});

function HighlightIndicator(panelButton) {
	this._init(panelButton);
}

HighlightIndicator.prototype = {
	_init: function(panelButton) {
		this.panelButton = panelButton;
		this.config = panelButton.config;
		this.numIcon = panelButton.numIcon; 
		this.capsIcon = panelButton.capsIcon;
		
		if (this.config.isShowNumLock())
			this.numIcon.show();
		else
			this.numIcon.hide();
		
		if (this.config.isShowCapsLock())
			this.capsIcon.show();
		else
			this.capsIcon.hide();
	},
	
	displayState: function(numlock_state, capslock_state) {
		this.panelButton.actor.visible = true;
		
		if (this.config.isShowNumLock())
			if (numlock_state)
				this.numIcon.set_gicon( this.panelButton._getCustIcon('numlock-enabled-symbolic') );
			else
				this.numIcon.set_gicon( this.panelButton._getCustIcon('numlock-disabled-symbolic') );
		if (this.config.isShowCapsLock())
			if (capslock_state)
				this.capsIcon.set_gicon( this.panelButton._getCustIcon('capslock-enabled-symbolic') );
			else
				this.capsIcon.set_gicon( this.panelButton._getCustIcon('capslock-disabled-symbolic') );

	}
}

function ShowhideIndicator(panelButton) {
	this._init(panelButton);
}

ShowhideIndicator.prototype = {
	_init: function(panelButton) {
		this.panelButton = panelButton;
		this.config = panelButton.config;
		this.numIcon = panelButton.numIcon; 
		this.capsIcon = panelButton.capsIcon;
		
		this.numIcon.set_gicon( this.panelButton._getCustIcon('numlock-enabled-symbolic') );
		this.capsIcon.set_gicon( this.panelButton._getCustIcon('capslock-enabled-symbolic') );
	},
	
	displayState: function(numlock_state, capslock_state) {
		this.panelButton.actor.visible = (numlock_state && this.config.isShowNumLock()) || (capslock_state && this.config.isShowCapsLock());

		if (numlock_state && this.config.isShowNumLock())
			this.numIcon.show();
		else
			this.numIcon.hide();

		if (capslock_state && this.config.isShowCapsLock())
			this.capsIcon.show();
		else
			this.capsIcon.hide();
	}
}

function Configuration() {
	this._init();
}

Configuration.prototype = {
	_init: function() {
		this.settings = Utils.getSettings(Meta);
	},
	
	isShowNotifications: function() {
		return this.settings.get_boolean(NOTIFICATIONS);
	},
	
	isShowNumLock: function() {
		return this.settings.get_boolean(SHOW_NUMLOCK);
	},

	isShowCapsLock: function() {
		return this.settings.get_boolean(SHOW_CAPSLOCK);
	},
	
	isShowHideStyle: function() {
		let widget_style = this.settings.get_string(STYLE);
		return widget_style == STYLE_SHOWHIDE;
	},

	isHighlightStyle: function() {
		let widget_style = this.settings.get_string(STYLE);
		return widget_style == STYLE_HIGHLIGHT;
	}
}
