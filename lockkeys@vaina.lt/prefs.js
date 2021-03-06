const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Gettext = imports.gettext.domain('lockkeys');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Meta = ExtensionUtils.getCurrentExtension();
const Utils = Meta.imports.utils;

const STYLE = 'style';
const STYLE_HIGHLIGHT = 'highlight';
const STYLE_SHOWHIDE = 'show-hide';
const NOTIFICATIONS = 'notifications';
const SHOW_NUMLOCK = 'show-numlock';
const SHOW_CAPSLOCK = 'show-capslock';

let settings;

function init() {
	settings = Utils.getSettings(Meta);
	Utils.initTranslations("lockkeys");
}

function buildPrefsWidget() {
	let frame = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
		border_width: 10, margin: 20});
	frame.set_spacing(10);
	//can not use constants here like STYLE_NUMLOCK etc, don't know why
	frame.add(_createCheckBox(SHOW_CAPSLOCK, _("Capslock"), _("Displays informations about capslock")));
	frame.add(_createCheckBox(SHOW_NUMLOCK, _("Numlock"), _("Displays informations about numlock")));
	frame.add(_createComboBox(STYLE, _("Indicator Style"), _("Change indicator display options"),
			{ 'show-hide' : _("Show/Hide"), 'highlight': _("Highlight")}));
	frame.add(_createCheckBox(NOTIFICATIONS, _("Notifications"), _("Show notifications when state changes")));
	
	frame.show_all();
	return frame;
}

function _createCheckBox(key, text, tooltip) {
	let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
	let label = new Gtk.Label({ label: text, xalign: 0, tooltip_text:tooltip });
	let widget = new Gtk.Switch({ active: settings.get_boolean(key) });
	widget.connect('notify::active', function(switch_widget) {
		settings.set_boolean(key, switch_widget.active);
	});

	box.pack_start(label, true, true, 0);
	box.add(widget);
	return box;
}

function _createComboBox(key, text, tooltip, values)
{
	let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
	let label = new Gtk.Label({ label: text, xalign: 0, tooltip_text:tooltip });
	let widget = new Gtk.ComboBoxText();
	for (id in values) {
		widget.append(id, values[id]);
	}
	widget.set_active_id(settings.get_string(key));
	widget.connect('changed', function(combo_widget) {
		settings.set_string(key, combo_widget.get_active_id());
	});
	box.pack_start(label, true, true, 0);
	box.add(widget);
	return box;
}

