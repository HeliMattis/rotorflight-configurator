'use strict';

TABS.servos = {

    isDirty: false,

    MAX_SERVOS: 8,
    OVERRIDE_OFF: 2001,
};

TABS.servos.initialize = function (callback) {
    const self = this;

    load_data(load_html);

    function load_data(callback) {
        MSP.promise(MSPCodes.MSP_STATUS)
            .then(() => MSP.promise(MSPCodes.MSP_SERVO_CONFIGURATIONS))
            .then(() => MSP.promise(MSPCodes.MSP_SERVO_OVERRIDE))
            .then(() => MSP.promise(MSPCodes.MSP_SERVO))
            .then(callback);
    }

    function save_data(callback) {
        mspHelper.sendServoConfigurations(function () {
            MSP.send_message(MSPCodes.MSP_EEPROM_WRITE, false, false, function () {
                GUI.log(i18n.getMessage('eepromSaved'));
                if (callback) callback();
            });
        });
    }

    function load_html() {
        $('#content').load("./tabs/servos.html", process_html);
    }

    function process_html() {

        // translate to user-selected language
        i18n.localizePage();

        // UI Hooks

        // Hide the buttons toolbar
        $('.tab-servos').addClass('toolbar_hidden');

        self.isDirty = false;

        function setDirty() {
            if (!self.isDirty) {
                self.isDirty = true;
                $('.tab-servos').removeClass('toolbar_hidden');
            }
        }

        function process_override(servoIndex) {

            const servoOverride = $('#tab-servos-templates .servoOverrideTemplate tr').clone();
            const servoSlider = servoOverride.find('.servoOverrideSlider');
            const servoEnable = servoOverride.find('.servoOverrideEnable input');
            const servoInput  = servoOverride.find('.servoOverrideInput input');

            servoOverride.attr('class', `servoOverride${servoIndex}`);
            servoOverride.find('.servoOverrideIndex').text(`#${servoIndex+1}`);

            servoSlider.noUiSlider({
                range: {
                    'min': -90,
                    'max':  90,
                },
                start: 0,
                step: 5,
                behaviour: 'snap-drag',
            });

            servoOverride.find('.pips-range').noUiSlider_pips({
                mode: 'values',
                values: [ -80, -60, -40, -20, 0, 20, 40, 60, 80, ],
                density: 2.7777777777,
                stepped: true,
                format: wNumb({
                    decimals: 0,
                }),
            });

            servoSlider.on('slide', function () {
                servoInput.val(parseInt($(this).val()));
            });

            servoSlider.on('change', function () {
                servoInput.change();
            });

            servoInput.change(function () {
                const value = $(this).val();
                servoSlider.val(value);
                FC.SERVO_OVERRIDE[servoIndex] = Math.round(value * 1000 / 60);
                mspHelper.sendServoOverride(servoIndex);
            });

            servoEnable.change(function () {
                const check = $(this).prop('checked');
                const value = check ? 0 : self.OVERRIDE_OFF;

                servoInput.val(0);
                servoSlider.val(0);
                servoInput.prop('disabled', !check);
                servoSlider.attr('disabled', !check);

                FC.SERVO_OVERRIDE[servoIndex] = value;
                mspHelper.sendServoOverride(servoIndex);
            });

            const value = FC.SERVO_OVERRIDE[servoIndex];
            const check = (value >= -2000 && value <= 2000);
            const angle = check ? Math.round(value * 60 / 1000) : 0;

            servoInput.val(angle);
            servoSlider.val(angle);

            servoInput.prop('disabled', !check);
            servoSlider.attr('disabled', !check);
            servoEnable.prop('checked', check);

            $('.servoOverride tbody').append(servoOverride);
        }

        function process_config(servoIndex) {

            const servoConfig = $('#tab-servos-templates .servoConfigTemplate tr').clone();

            const SERVO = FC.SERVO_CONFIG[servoIndex];
            const rate = Math.abs(SERVO.rate);
            const revs = (SERVO.rate < 0);

            servoConfig.attr('class', `servoConfig${servoIndex}`);
            servoConfig.data('index', servoIndex);

            servoConfig.find('#index').text(`#${servoIndex+1}`);
            servoConfig.find('#mid').val(SERVO.mid);
            servoConfig.find('#min').val(SERVO.min);
            servoConfig.find('#max').val(SERVO.max);
            servoConfig.find('#rate').val(rate);
            servoConfig.find('#trim').val(SERVO.trim);
            servoConfig.find('#speed').val(SERVO.speed);
            servoConfig.find('#reversed').prop('checked', revs);

            servoConfig.find('#reversed').change(function() {
                const input = servoConfig.find('#trim');
                input.val(-parseInt(input.val()));
            });

            servoConfig.find('input').change(function () {
                update_servo_config(servoIndex);
                mspHelper.sendServoConfig(servoIndex);
            });

            $('.servoConfig tbody').append(servoConfig);
        }

        function update_servo_config(servoIndex) {

            const servo = $(`.tab-servos .servoConfig${servoIndex}`);
            const direc = $('#reversed',servo).prop('checked') ? -1 : 1;

            FC.SERVO_CONFIG[servoIndex].mid = parseInt($('#mid',servo).val());
            FC.SERVO_CONFIG[servoIndex].min = parseInt($('#min',servo).val());
            FC.SERVO_CONFIG[servoIndex].max = parseInt($('#max',servo).val());
            FC.SERVO_CONFIG[servoIndex].rate = parseInt($('#rate',servo).val()) * direc;
            FC.SERVO_CONFIG[servoIndex].trim = parseInt($('#trim',servo).val());
            FC.SERVO_CONFIG[servoIndex].speed = parseInt($('#speed',servo).val());
        }

        function update_servo_bars() {

            let rangeMin, rangeMax, length, margin;

            for (let i = 0; i < FC.SERVO_DATA.length; i++) {
                const servoMeter = $(`.tab-servos .servoConfig${i} .meter`);
                const servoValue = FC.SERVO_DATA[i];

                if (FC.SERVO_CONFIG[i].mid < 1000) {
                    rangeMin = 375;
                    rangeMax = 1125;
                } else {
                    rangeMin = 750;
                    rangeMax = 2250;
                }

                const range  = rangeMax - rangeMin;
                const percnt = 100 * (servoValue - rangeMin) / range;
                const length = Math.max(Math.min(percnt, 100), 0);
                const margin = 100 - length;

                $('.meter-fill', servoMeter).css({
                    'width'        : `${length}%`,
                    'margin-right' : `${margin}%`,
                });
                $('.meter-label', servoMeter).text(servoValue);
            }
        }

        function update_servos() {
            MSP.send_message(MSPCodes.MSP_SERVO, false, false, update_servo_bars);
        }

        $('.tab-servos .override').toggle(!FC.CONFIG.servoOverrideDisabled);

        for (let index = 0; index < FC.CONFIG.servoCount; index++) {
            process_config(index);
            if (!FC.CONFIG.servoOverrideDisabled)
                process_override(index);
        }

        self.prevConfig = self.cloneConfig(FC.SERVO_CONFIG);

        self.save = function(callback) {
            for (let index = 0; index < FC.CONFIG.servoCount; index++) {
                update_servo_config(index);
            }
            save_data(callback);
        };

        self.revert = function (callback) {
            FC.SERVO_CONFIG = self.prevConfig;
            mspHelper.sendServoConfigurations(callback);
        };

        $('a.save').click(function () {
            self.save(() => GUI.tab_switch_reload());
        });

        $('a.revert').click(function () {
            self.revert(() => GUI.tab_switch_reload());
        });

        $('.configuration').change(function () {
            setDirty();
        });

        GUI.interval_add('servo_pull', update_servos, 100);

        GUI.content_ready(callback);
    }
};

TABS.servos.cleanup = function (callback) {
    this.isDirty = false;

    if (callback) callback();
};

TABS.servos.cloneConfig = function (servos) {
    const clone = [];

    function cloneServo(a) {
        return { mid: a.mid, min: a.min, max: a.max, rate: a.rate, trim: a.trim, speed: a.speed, };
    };

    servos.forEach(function (item) {
        clone.push(cloneServo(item));
    });

    return clone;
};
