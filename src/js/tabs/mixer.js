'use strict';

TABS.mixer = {
    isDirty: false,
    needReboot: false,

    MIXER_CONFIG_dirty: false,
    MIXER_INPUTS_dirty: false,
    MIXER_RULES_dirty: false,

    MIXER_OVERRIDE_MIN: -2500,
    MIXER_OVERRIDE_MAX:  2500,
    MIXER_OVERRIDE_OFF:  2501,

    swashType: 0,
    tailMode: 0,

    prevInputs: null,
    prevRules: null,

    showInputs: [ 1,2,4,3, ],
    showOverrides: [ 1,2,4,3, ],

    inputAttr: [
        { min:-1500, max:1500, step:10,   fixed:0, scale:1.000 },
        { min:-24,   max:24,   step:0.1,  fixed:1, scale:0.012 },
        { min:-24,   max:24,   step:0.1,  fixed:1, scale:0.012 },
        { min:-100,  max:100,  step:1,    fixed:0, scale:0.100 },
        { min:-24,   max:24,   step:0.1,  fixed:1, scale:0.012 },
    ],
    overrideAttr: [
        { min:-1500, max:1500, step:50,   fixed:0, scale:1.000 },
        { min:-18,   max:18,   step:0.1,  fixed:1, scale:0.012 },
        { min:-18,   max:18,   step:0.1,  fixed:1, scale:0.012 },
        { min:-100,  max:100,  step:1,    fixed:0, scale:0.100 },
        { min:-18,   max:18,   step:0.1,  fixed:1, scale:0.012 },
    ],
};

TABS.mixer.initialize = function (callback) {
    const self = this;

    load_data(load_html);

    function load_html() {
        $('#content').load("./tabs/mixer.html", process_html);
    }

    function load_data(callback) {
        MSP.promise(MSPCodes.MSP_STATUS)
            .then(() => MSP.promise(MSPCodes.MSP_FEATURE_CONFIG))
            .then(() => MSP.promise(MSPCodes.MSP_MIXER_CONFIG))
            .then(() => MSP.promise(MSPCodes.MSP_MIXER_INPUTS))
            .then(() => MSP.promise(MSPCodes.MSP_MIXER_RULES))
            .then(() => MSP.promise(MSPCodes.MSP_MIXER_OVERRIDE))
            .then(callback);
    }

    function save_data(callback) {
        function send_mixer_config() {
            if (self.MIXER_CONFIG_dirty)
                MSP.send_message(MSPCodes.MSP_SET_MIXER_CONFIG, mspHelper.crunch(MSPCodes.MSP_SET_MIXER_CONFIG), false, send_mixer_inputs);
            else
                send_mixer_inputs();
        }
        function send_mixer_inputs() {
            if (self.MIXER_INPUTS_dirty)
                mspHelper.sendMixerInputs(send_mixer_rules);
            else
                send_mixer_rules();
        }
        function send_mixer_rules() {
            if (self.MIXER_RULES_dirty)
                mspHelper.sendMixerRules(save_eeprom);
            else
                save_eeprom();
        }
        function save_eeprom() {
            if (self.MIXER_CONFIG_dirty || self.MIXER_INPUTS_dirty || self.MIXER_RULES_dirty)
                MSP.send_message(MSPCodes.MSP_EEPROM_WRITE, false, false, eeprom_saved);
            else
                save_done();
        }
        function eeprom_saved() {
            GUI.log(i18n.getMessage('eepromSaved'));
            save_done();
        }
        function save_done() {
            self.MIXER_CONFIG_dirty = false;
            self.MIXER_INPUTS_dirty = false;
            self.MIXER_RULES_dirty = false;
            self.isDirty = false;

            if (self.needReboot) {
                MSP.send_message(MSPCodes.MSP_SET_REBOOT);
                GUI.log(i18n.getMessage('deviceRebooting'));
                reinitialiseConnection(callback);
            }
            else {
                if (callback) callback();
            }
        }

        send_mixer_config();
    }

    function revert_data(callback) {
        function send_mixer_inputs() {
            if (self.MIXER_INPUTS_dirty)
                mspHelper.sendMixerInputs(send_mixer_rules);
            else
                send_mixer_rules();
        }
        function send_mixer_rules() {
            if (self.MIXER_RULES_dirty)
                mspHelper.sendMixerRules(revert_done);
            else
                revert_done();
        }
        function revert_done() {
            self.MIXER_INPUTS_dirty = false;
            self.MIXER_RULES_dirty = false;

            if (callback) callback();
        }

        send_mixer_inputs();
    }

    function add_input(inputIndex) {

        const mixerInput = $('#tab-mixer-templates .mixerInputTemplate tr').clone();

        const inputName = mixerInput.find('#name');
        const inputRate = mixerInput.find('#rate');
        const inputMin  = mixerInput.find('#min');
        const inputMax  = mixerInput.find('#max');

        const input = FC.MIXER_INPUTS[inputIndex];
        const attr = self.inputAttr[inputIndex];

        mixerInput.attr('class', `mixerInput${inputIndex}`);
        mixerInput.data('index', inputIndex);

        inputName.text(i18n.getMessage(Mixer.inputNames[inputIndex]));
        inputRate.val(input.rate).change();
        inputMax.attr(attr)
            .val((input.max * attr.scale).toFixed(attr.fixed))
            .change();
        inputMin.attr(attr)
            .val((input.min * attr.scale).toFixed(attr.fixed))
            .change();

        $('.mixerInputs tbody').append(mixerInput);

        mixerInput.change(function() {
            input.rate = parseInt(inputRate.val());
            input.max = parseFloat(inputMax.val()) / attr.scale;
            input.min = parseFloat(inputMin.val()) / attr.scale;

            mspHelper.sendMixerInput(inputIndex);
        });
    }

    function add_override(inputIndex) {

        const mixerOverride = $('#tab-mixer-templates .mixerOverrideTemplate tr').clone();

        const mixerSlider = mixerOverride.find('.mixerOverrideSlider');
        const mixerEnable = mixerOverride.find('.mixerOverrideEnable input');
        const mixerInput  = mixerOverride.find('.mixerOverrideInput input');

        const attr = self.overrideAttr[inputIndex];

        mixerOverride.attr('class', `mixerOverride${inputIndex}`);
        mixerOverride.find('.mixerOverrideName').text(i18n.getMessage(Mixer.inputNames[inputIndex]));

        mixerInput.attr(attr);

        switch (inputIndex) {
            case 1:
            case 2:
            case 4:
            {
                mixerSlider.noUiSlider({
                    range: {
                        'min': -18,
                        'max':  18,
                    },
                    start: 0,
                    step: 1,
                    behaviour: 'snap-drag',
                });

                mixerOverride.find('.pips-range').noUiSlider_pips({
                    mode: 'values',
                    values: [ -18, -15, -12, -9, -6, -3, 0, 3, 6, 9, 12, 15, 18, ],
                    density: 100 / ((18 + 18) / 1),
                    stepped: true,
                    format: wNumb({
                        decimals: 0,
                    }),
                });
            }
            break;

            case 3:
            {
                mixerSlider.noUiSlider({
                    range: {
                        'min': -100,
                        'max':  100,
                    },
                    start: 0,
                    step: 5,
                    behaviour: 'snap-drag',
                });

                mixerOverride.find('.pips-range').noUiSlider_pips({
                    mode: 'values',
                    values: [ -100, -75, -50, -25, 0, 25, 50, 75, 100, ],
                    density: 100 / ((100 + 100) / 5),
                    stepped: true,
                    format: wNumb({
                        decimals: 0,
                    }),
                });
            }
            break;

            default:
            {
                mixerSlider.noUiSlider({
                    range: {
                        'min': -1500,
                        'max':  1500,
                    },
                    start: 0,
                    step: 50,
                    behaviour: 'snap-drag',
                });

                mixerOverride.find('.pips-range').noUiSlider_pips({
                    mode: 'values',
                    values: [ -1500, -1000, -500, 0, 500, 1000, 1500, ],
                    density: 100 / ((1500 + 1500) / 100),
                    stepped: true,
                    format: wNumb({
                        decimals: 0,
                    }),
                });
            }
            break;
        }

        mixerSlider.on('slide', function () {
            mixerInput.val(Number($(this).val()).toFixed(attr.fixed));
        });

        mixerSlider.on('change', function () {
            mixerInput.change();
        });

        mixerInput.change(function () {
            const value = $(this).val();
            mixerSlider.val(value);
            FC.MIXER_OVERRIDE[inputIndex] = Math.round(value / attr.scale);
            mspHelper.sendMixerOverride(inputIndex);
        });

        mixerEnable.change(function () {
            const check = $(this).prop('checked');
            const value = check ? 0 : self.MIXER_OVERRIDE_OFF;

            mixerInput.val(0);
            mixerSlider.val(0);

            mixerInput.prop('disabled', !check);
            mixerSlider.attr('disabled', !check);

            FC.MIXER_OVERRIDE[inputIndex] = value;
            mspHelper.sendMixerOverride(inputIndex);
        });

        let value = FC.MIXER_OVERRIDE[inputIndex];
        let check = (value >= self.MIXER_OVERRIDE_MIN && value <= self.MIXER_OVERRIDE_MAX);

        value *= attr.scale;
        value = (check ? value : 0).toFixed(attr.fixed);

        mixerInput.val(value);
        mixerSlider.val(value);

        mixerInput.prop('disabled', !check);
        mixerSlider.attr('disabled', !check);
        mixerEnable.prop('checked', check);

        $('.mixerOverride tbody').append(mixerOverride);
    }

    function data_to_form() {

        self.isDirty = false;
        self.needReboot = false;

        self.MIXER_CONFIG_dirty = false;
        self.MIXER_INPUTS_dirty = false;
        self.MIXER_RULES_dirty = false;

        self.tailMode = FC.MIXER_CONFIG.tail_rotor_mode;

        Mixer.initialize(self.tailMode);

        self.swashType = Mixer.findMixer(FC.MIXER_RULES);
        self.prevRules = Mixer.cloneRules(FC.MIXER_RULES);
        self.prevInputs = Mixer.cloneInputs(FC.MIXER_INPUTS);

        const mixerSwashType = $('.tab-mixer #mixerSwashType');
        const mixerTailMode = $('.tab-mixer #mixerTailRotorMode');

        if (self.swashType == -1)
            mixerSwashType.append($('<option value="-1" disabled>[Select]</option>'));
        if (self.swashType == 0)
            mixerSwashType.append($('<option value="0" disabled>' + i18n.getMessage(Mixer.swashTypes[0]) + '</option>'));

        Mixer.swashTypes.forEach(function(name,index) {
            if (index > 0)
                mixerSwashType.append($(`<option value="${index}">` + i18n.getMessage(name) + '</option>'));
        });

        const mixerRuleOpers   = $('.mixerRuleTemplate #oper');
        const mixerRuleInputs  = $('.mixerRuleTemplate #input');
        const mixerRuleOutputs = $('.mixerRuleTemplate #output');

        Mixer.operNames.forEach(function(name,index) {
            mixerRuleOpers.append($(`<option value="${index}">` + i18n.getMessage(name)  + '</option>'));
        });

        Mixer.inputNames.forEach(function(name,index) {
            mixerRuleInputs.append($(`<option value="${index}">` + i18n.getMessage(name)  + '</option>'));
        });

        Mixer.outputNames.forEach(function(name,index) {
            mixerRuleOutputs.append($(`<option value="${index}">` + i18n.getMessage(name) + '</options>'));
        });

        self.showInputs.forEach(function(index) {
            add_input(index);
        });

        if (!FC.CONFIG.mixerOverrideDisabled) {
            self.showOverrides.forEach(function(index) {
                add_override(index);
            });
        }

        $('.tab-mixer .override').toggle(!FC.CONFIG.mixerOverrideDisabled);

        mixerSwashType.change(function () {
            const swashType = parseInt($(this).val());
            if (swashType != 0) {
                $('.mixerCustomNote').hide();
                if (self.swashType == 0) {
                    $('.dialogMixerReset')[0].showModal();
                }
            }
        });

        $('.dialogMixerReset-acceptbtn').click(function() {
            $('.dialogMixerReset')[0].close();
        });
        $('.dialogMixerReset-revertbtn').click(function() {
            $('.dialogMixerReset')[0].close();
            mixerSwashType.val(0);
        });

        mixerTailMode.change(function () {
            const val = $(this).val();
            $('.tailRotorMotorized').toggle( val != 0 );
            $('.mixerBidirNote').toggle( val == 2 );
        });

        $('.mixerCustomNote').toggle( self.swashType == 0 );
        $('.mixerBidirNote').toggle( self.tailMode == 2 );
        $('.tailRotorMotorized').toggle( self.tailMode != 0 );

        $('.tab-mixer #mixerMainRotorDirection').val(FC.MIXER_CONFIG.main_rotor_dir);
        $('.tab-mixer #mixerSwashType').val(self.swashType);
        $('.tab-mixer #mixerSwashRing').val(FC.MIXER_CONFIG.swash_ring);

        $('.tab-mixer #mixerTailRotorMode').val(self.tailMode);
        $('.tab-mixer #mixerTailMotorIdle').val(FC.MIXER_CONFIG.tail_motor_idle / 10);
    }

    function form_to_data() {

        const swashType = parseInt($('.tab-mixer #mixerSwashType').val());
        const tailMode  = parseInt($('.tab-mixer #mixerTailRotorMode').val());

        if (swashType != self.swashType || tailMode != self.tailMode) {
            if (swashType != 0) {
                Mixer.initialize(tailMode);
                FC.MIXER_RULES = Mixer.getMixer(swashType);
                self.MIXER_RULES_dirty = true;
            }
        }

        FC.MIXER_CONFIG.main_rotor_dir = parseInt($('.tab-mixer #mixerMainRotorDirection').val());
        FC.MIXER_CONFIG.swash_ring = parseInt($('.tab-mixer #mixerSwashRing').val());

        FC.MIXER_CONFIG.tail_rotor_mode = tailMode;
        FC.MIXER_CONFIG.tail_motor_idle = $('.tab-mixer #mixerTailMotorIdle').val() * 10;
    }

    function process_html() {

        // translate to user-selected language
        i18n.localizePage();

        // UI Hooks
        data_to_form();

        // Hide the buttons toolbar
        $('.tab-mixer').addClass('toolbar_hidden');

        const saveBtn = $('.save_btn');
        const rebootBtn = $('.reboot_btn');

        function setDirty(reboot) {
            if (!self.isDirty) {
                self.isDirty = true;
                $('.tab-mixer').removeClass('toolbar_hidden');
            }
            if (reboot)
                self.needReboot = true;
            saveBtn.toggle(!self.needReboot);
            rebootBtn.toggle(self.needReboot);
        }

        $('.mixerConfigs').change(function () {
            self.MIXER_CONFIG_dirty = true;
            setDirty(true);
        });
        $('.mixerInputs').change(function () {
            self.MIXER_INPUTS_dirty = true;
            setDirty(false);
        });
        $('.mixerRules').change(function () {
            self.MIXER_RULES_dirty = true;
            setDirty(true);
        });

        self.save = function (callback) {
            form_to_data();
            save_data(callback);
        };

        self.revert = function (callback) {
            if (self.MIXER_RULES_dirty)
                FC.MIXER_RULES = self.prevRules;
            if (self.MIXER_INPUTS_dirty)
                FC.MIXER_INPUTS = self.prevInputs;
            revert_data(callback);
        };

        $('a.save').click(function () {
            self.save(() => GUI.tab_switch_reload());
        });

        $('a.reboot').click(function () {
            self.save(() => GUI.tab_switch_reload());
        });

        $('a.revert').click(function () {
            self.revert(() => GUI.tab_switch_reload());
        });

         GUI.content_ready(callback);
    }
};

TABS.mixer.cleanup = function (callback) {
    this.isDirty = false;

    if (callback) callback();
};

