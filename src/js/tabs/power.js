'use strict';

TABS.power = {
    isDirty: false,
    analyticsChanges: {},
};

TABS.power.initialize = function (callback) {
    const self = this;

    if (GUI.calibrationManager) {
        GUI.calibrationManager.destroy();
    }
    if (GUI.calibrationManagerConfirmation) {
        GUI.calibrationManagerConfirmation.destroy();
    }

    load_data(load_html);

    function load_html() {
        $('#content').load("./tabs/power.html", process_html);
    }

    function load_data(callback) {
        Promise.resolve(true)
            .then(() => MSP.promise(MSPCodes.MSP_STATUS))
            .then(() => MSP.promise(MSPCodes.MSP_VOLTAGE_METERS))
            .then(() => MSP.promise(MSPCodes.MSP_CURRENT_METERS))
            .then(() => MSP.promise(MSPCodes.MSP_CURRENT_METER_CONFIG))
            .then(() => MSP.promise(MSPCodes.MSP_VOLTAGE_METER_CONFIG))
            .then(() => MSP.promise(MSPCodes.MSP_BATTERY_STATE))
            .then(() => MSP.promise(MSPCodes.MSP_BATTERY_CONFIG))
            .then(callback);
    }

    function save_data(callback) {
        function save_battery_config() {
            MSP.send_message(MSPCodes.MSP_SET_BATTERY_CONFIG, mspHelper.crunch(MSPCodes.MSP_SET_BATTERY_CONFIG), false, save_voltage_config);
        }
        function save_voltage_config() {
            mspHelper.sendVoltageConfig(save_current_config);
        }
        function save_current_config() {
            mspHelper.sendCurrentConfig(save_to_eeprom);
        }
        function save_to_eeprom() {
            MSP.send_message(MSPCodes.MSP_EEPROM_WRITE, false, false, save_completed);
        }
        function save_completed() {
            GUI.log(i18n.getMessage('eepromSaved'));
            if (callback) callback();
        }

        save_battery_config();
    }

    function updateData() {
        for (let index = 0; index < FC.VOLTAGE_METER_CONFIGS.length; index++) {
            FC.VOLTAGE_METER_CONFIGS[index].vbatscale = parseInt($(`input[name="vbatscale-${index}"]`).val());
            FC.VOLTAGE_METER_CONFIGS[index].vbatresdivval = parseInt($(`input[name="vbatresdivval-${index}"]`).val());
            FC.VOLTAGE_METER_CONFIGS[index].vbatresdivmultiplier = parseInt($(`input[name="vbatresdivmultiplier-${index}"]`).val());
        }

        for (let index = 0; index < FC.CURRENT_METER_CONFIGS.length; index++) {
            FC.CURRENT_METER_CONFIGS[index].scale = parseInt($(`input[name="amperagescale-${index}"]`).val());
            FC.CURRENT_METER_CONFIGS[index].offset = parseInt($(`input[name="amperageoffset-${index}"]`).val());
        }

        FC.BATTERY_CONFIG.vbatmincellvoltage = parseFloat($('input[name="mincellvoltage"]').val());
        FC.BATTERY_CONFIG.vbatmaxcellvoltage = parseFloat($('input[name="maxcellvoltage"]').val());
        FC.BATTERY_CONFIG.vbatwarningcellvoltage = parseFloat($('input[name="warningcellvoltage"]').val());

        FC.BATTERY_CONFIG.capacity = parseInt($('input[name="capacity"]').val());
    }

    function updateDisplay(voltageDataSource, currentDataSource) {
        // voltage meters
        if (FC.BATTERY_CONFIG.voltageMeterSource == 0) {
            $('.boxVoltageConfiguration').hide();
        } else {
            $('.boxVoltageConfiguration').show();
        }

        if (!voltageDataSource) {
            voltageDataSource = [];
            for (let index = 0; index < FC.VOLTAGE_METER_CONFIGS.length; index++) {
                voltageDataSource[index] = {
                    vbatscale: parseInt($(`input[name="vbatscale-${index}"]`).val()),
                    vbatresdivval: parseInt($(`input[name="vbatresdivval-${index}"]`).val()),
                    vbatresdivmultiplier: parseInt($(`input[name="vbatresdivmultiplier-${index}"]`).val())
                };
            }
        }

        const templateVoltageMeter = $('#tab-power-templates .voltage-meters .voltage-meter');
        const destinationVoltageMeter = $('.tab-power .voltage-meters');
        destinationVoltageMeter.empty();
        for (let index = 0; index < FC.VOLTAGE_METERS.length; index++) {
            const elementVoltageMeter = templateVoltageMeter.clone();
            $(elementVoltageMeter).attr('id', `voltage-meter-${index}`);

            const message = i18n.getMessage('powerVoltageId' + FC.VOLTAGE_METERS[index].id);
            $(elementVoltageMeter).find('.label').text(message);
            destinationVoltageMeter.append(elementVoltageMeter);

            elementVoltageMeter.hide();
            if ((FC.BATTERY_CONFIG.voltageMeterSource == 1 && FC.VOLTAGE_METERS[index].id == 10)  // TODO: replace hardcoded constants
                || (FC.BATTERY_CONFIG.voltageMeterSource == 2 && FC.VOLTAGE_METERS[index].id >= 50)) {
                elementVoltageMeter.show();
            }
        }

        const templateVoltageConfiguration = $('#tab-power-templates .voltage-configuration');
        for (let index = 0; index < FC.VOLTAGE_METER_CONFIGS.length; index++) {
            const destinationVoltageConfiguration = $(`#voltage-meter-${index} .configuration`);
            const elementVoltageConfiguration = templateVoltageConfiguration.clone();

            const attributeNames = ["vbatscale", "vbatresdivval", "vbatresdivmultiplier"];
            for (let attributeName of attributeNames) {
                $(elementVoltageConfiguration).find(`input[name="${attributeName}"]`).attr('name', attributeName + '-' + index);
            }
            destinationVoltageConfiguration.append(elementVoltageConfiguration);

            $(`input[name="vbatscale-${index}"]`).val(voltageDataSource[index].vbatscale).change();
            $(`input[name="vbatresdivval-${index}"]`).val(voltageDataSource[index].vbatresdivval).change();
            $(`input[name="vbatresdivmultiplier-${index}"]`).val(voltageDataSource[index].vbatresdivmultiplier).change();
        }

        $('input[name="vbatscale-0"]').change(function () {
            const value = parseInt($(this).val());

            if (value !== voltageDataSource[0].vbatscale) {
                self.analyticsChanges['PowerVBatUpdated'] = value;
            }
        });

        // amperage meters
        if (FC.BATTERY_CONFIG.currentMeterSource == 0) {
            $('.boxAmperageConfiguration').hide();
        } else {
            $('.boxAmperageConfiguration').show();
        }

        if (!currentDataSource) {
            currentDataSource = [];
            for (let index = 0; index < FC.CURRENT_METER_CONFIGS.length; index++) {
                currentDataSource[index] = {
                    scale: parseInt($(`input[name="amperagescale-${index}"]`).val()),
                    offset: parseInt($(`input[name="amperageoffset-${index}"]`).val()),
                };
            }
        }
        const templateAmperageMeter = $('#tab-power-templates .amperage-meters .amperage-meter');
        const destinationAmperageMeter = $('.tab-power .amperage-meters');
        destinationAmperageMeter.empty();
        for (let index = 0; index < FC.CURRENT_METERS.length; index++) {
            const elementAmperageMeter = templateAmperageMeter.clone();
            $(elementAmperageMeter).attr('id', `amperage-meter-${index}`);

            const message = i18n.getMessage('powerAmperageId' + FC.CURRENT_METERS[index].id);
            $(elementAmperageMeter).find('.label').text(message);
            destinationAmperageMeter.append(elementAmperageMeter);

            elementAmperageMeter.hide();
            if ((FC.BATTERY_CONFIG.currentMeterSource == 1 && FC.CURRENT_METERS[index].id == 10)              // TODO: replace constants
                || (FC.BATTERY_CONFIG.currentMeterSource == 2 && FC.CURRENT_METERS[index].id == 80)
                || (FC.BATTERY_CONFIG.currentMeterSource == 3 && FC.CURRENT_METERS[index].id >= 50 && FC.CURRENT_METERS[index].id < 80)) {
                    elementAmperageMeter.show();
            }
        }

        const templateAmperageConfiguration = $('#tab-power-templates .amperage-configuration');
        for (let index = 0; index < FC.CURRENT_METER_CONFIGS.length; index++) {
            const destinationAmperageConfiguration = $(`#amperage-meter-${index} .configuration`);
            const elementAmperageConfiguration = templateAmperageConfiguration.clone();

            const attributeNames = ["amperagescale", "amperageoffset"];
            for (let attributeName of attributeNames) {
                $(elementAmperageConfiguration).find(`input[name="${attributeName}"]`).attr('name', `${attributeName}-${index}`);
            }
            destinationAmperageConfiguration.append(elementAmperageConfiguration);

            $(`input[name="amperagescale-${index}"]`).val(currentDataSource[index].scale).change();
            $(`input[name="amperageoffset-${index}"]`).val(currentDataSource[index].offset).change();
        }

        $('input[name="amperagescale-0"]').change(function () {
            if (FC.BATTERY_CONFIG.currentMeterSource === 1) {
                let value = parseInt($(this).val());

                if (value !== currentDataSource[0].scale) {
                    self.analyticsChanges['PowerAmperageUpdated'] = value;
                }
            }
        });

        $('input[name="amperagescale-1"]').change(function () {
            if (FC.BATTERY_CONFIG.currentMeterSource === 2) {
                let value = parseInt($(this).val());

                if (value !== currentDataSource[1].scale) {
                    self.analyticsChanges['PowerAmperageUpdated'] = value;
                }
            }
        });

        if(FC.BATTERY_CONFIG.voltageMeterSource == 1 || FC.BATTERY_CONFIG.currentMeterSource == 1 || FC.BATTERY_CONFIG.currentMeterSource == 2) {
            $('.calibration').show();
        } else {
            $('.calibration').hide();
        }
    }

    function initDisplay() {
        $(".tab-power").addClass("supported");

        $("#calibrationmanagercontent").hide();
        $("#calibrationmanagerconfirmcontent").hide();

        const templateBatteryState = $('#tab-power-templates .battery-state .battery-state');
        const destinationBatteryState = $('.tab-power .battery-state');
        const elementBatteryState = templateBatteryState.clone();
        $(elementBatteryState).find('.connection-state').attr('id', 'battery-connection-state');
        $(elementBatteryState).find('.voltage').attr('id', 'battery-voltage');
        $(elementBatteryState).find('.mah-drawn').attr('id', 'battery-mah-drawn');
        $(elementBatteryState).find('.amperage').attr('id', 'battery-amperage');

        destinationBatteryState.append(elementBatteryState.children());

        const templateBatteryConfiguration = $('#tab-power-templates .battery-configuration');
        const destinationBatteryConfiguration = $('.tab-power .battery .configuration');
        const elementBatteryConfiguration = templateBatteryConfiguration.clone();
        destinationBatteryConfiguration.append(elementBatteryConfiguration);

        $('input[name="mincellvoltage"]').prop('step','0.01');
        $('input[name="maxcellvoltage"]').prop('step','0.01');
        $('input[name="warningcellvoltage"]').prop('step','0.01');

        $('input[name="mincellvoltage"]').val(FC.BATTERY_CONFIG.vbatmincellvoltage).change();
        $('input[name="maxcellvoltage"]').val(FC.BATTERY_CONFIG.vbatmaxcellvoltage).change();
        $('input[name="warningcellvoltage"]').val(FC.BATTERY_CONFIG.vbatwarningcellvoltage).change();
        $('input[name="capacity"]').val(FC.BATTERY_CONFIG.capacity).change();

        const haveFc = (FC.CONFIG.boardType == 0 || FC.CONFIG.boardType == 2);

        const batteryMeterTypes = [
            i18n.getMessage('powerBatteryVoltageMeterTypeNone'),
            i18n.getMessage('powerBatteryVoltageMeterTypeAdc'),
        ];

        if (haveFc) {
            batteryMeterTypes.push(i18n.getMessage('powerBatteryVoltageMeterTypeEsc'));
        }

        let batteryMeterType_e = $('select.batterymetersource');

        for (let i = 0; i < batteryMeterTypes.length; i++) {
            batteryMeterType_e.append(`<option value="${i}">${batteryMeterTypes[i]}</option>`);
        }

        const currentMeterTypes = [
            i18n.getMessage('powerBatteryCurrentMeterTypeNone'),
            i18n.getMessage('powerBatteryCurrentMeterTypeAdc'),
        ];

        if (haveFc) {
            currentMeterTypes.push(i18n.getMessage('powerBatteryCurrentMeterTypeEsc'));
            currentMeterTypes.push(i18n.getMessage('powerBatteryCurrentMeterTypeMsp'));
        }

        let currentMeterType_e = $('select.currentmetersource');

        for (let i = 0; i < currentMeterTypes.length; i++) {
            currentMeterType_e.append(`<option value="${i}">${currentMeterTypes[i]}</option>`);
        }

        updateDisplay(FC.VOLTAGE_METER_CONFIGS, FC.CURRENT_METER_CONFIGS);

        batteryMeterType_e = $('select.batterymetersource');

        let sourceschanged = false;
        batteryMeterType_e.val(FC.BATTERY_CONFIG.voltageMeterSource).change();
        batteryMeterType_e.change(function () {
            FC.BATTERY_CONFIG.voltageMeterSource = parseInt($(this).val());

            updateDisplay();
            sourceschanged = true;
        });

        currentMeterType_e = $('select.currentmetersource');
        currentMeterType_e.val(FC.BATTERY_CONFIG.currentMeterSource).change();
        currentMeterType_e.change(function () {
            FC.BATTERY_CONFIG.currentMeterSource = parseInt($(this).val());

            updateDisplay();
            sourceschanged = true;
        });

        function get_slow_data() {
            MSP.send_message(MSPCodes.MSP_VOLTAGE_METERS, false, false, function () {
                for (let i = 0; i < FC.VOLTAGE_METERS.length; i++) {
                    const elementVoltageMeters = $(`#voltage-meter-${i} .value`);
                    elementVoltageMeters.text(i18n.getMessage('powerVoltageValue', [FC.VOLTAGE_METERS[i].voltage]));
                }
            });

            MSP.send_message(MSPCodes.MSP_CURRENT_METERS, false, false, function () {
                for (let i = 0; i < FC.CURRENT_METERS.length; i++) {
                    const elementCurrentMeters = $(`#amperage-meter-${i} .value`);
                    elementCurrentMeters.text(i18n.getMessage('powerAmperageValue', [FC.CURRENT_METERS[i].amperage.toFixed(2)]));
                }
            });

            MSP.send_message(MSPCodes.MSP_BATTERY_STATE, false, false, function () {
                const elementPrefix = '#battery';
                let elementMspBatteryState;

                elementMspBatteryState = $(`${elementPrefix}-connection-state .value`);
                elementMspBatteryState.text(FC.BATTERY_STATE.cellCount > 0
                    ? i18n.getMessage('powerBatteryConnectedValueYes', [FC.BATTERY_STATE.cellCount])
                    : i18n.getMessage('powerBatteryConnectedValueNo'));
                elementMspBatteryState = $(`${elementPrefix}-voltage .value`);
                elementMspBatteryState.text(i18n.getMessage('powerVoltageValue', [FC.BATTERY_STATE.voltage]));
                elementMspBatteryState = $(`${elementPrefix}-mah-drawn .value`);
                elementMspBatteryState.text(i18n.getMessage('powerMahValue', [FC.BATTERY_STATE.mAhDrawn]));
                elementMspBatteryState = $(`${elementPrefix}-amperage .value`);
                elementMspBatteryState.text(i18n.getMessage('powerAmperageValue', [FC.BATTERY_STATE.amperage]));
            });

        }

        const saveButton = $('.content_toolbar .save_btn');
        const revertButton = $('.content_toolbar .revert_btn');

        saveButton.hide();
        revertButton.hide();

        self.isDirty = false;

        function setDirty() {
            if (!self.isDirty) {
                self.isDirty = true;
                saveButton.show();
                revertButton.show();
            }
        }

        //calibration manager
        let calibrationconfirmed = false;
        GUI.calibrationManager = new jBox('Modal', {
            width: 400,
            height: 230,
            closeButton: 'title',
            animation: false,
            attach: $('#calibrationmanager'),
            title: i18n.getMessage('powerCalibrationManagerTitle'),
            content: $('#calibrationmanagercontent'),
            onCloseComplete: function() {
                if (!calibrationconfirmed) {
                    GUI.tab_switch_reload();
                }
            },
        });

        GUI.calibrationManagerConfirmation = new jBox('Modal', {
            width: 400,
            height: 230,
            closeButton: 'title',
            animation: false,
            attach: $('#calibrate'),
            title: i18n.getMessage('powerCalibrationManagerConfirmationTitle'),
            content: $('#calibrationmanagerconfirmcontent'),
            onCloseComplete: function() {
                GUI.calibrationManager.close();
            },
        });

        $('a.calibrationmanager').click(function() {
            if (FC.BATTERY_CONFIG.voltageMeterSource == 1 && FC.BATTERY_STATE.voltage > 0.1){
                $('.vbatcalibration').show();
            } else {
                $('.vbatcalibration').hide();
            }
            if ((FC.BATTERY_CONFIG.currentMeterSource == 1 || FC.BATTERY_CONFIG.currentMeterSource == 2) && FC.BATTERY_STATE.amperage > 0.1) {
                $('.amperagecalibration').show();
            } else {
                $('.amperagecalibration').hide();
            }
            if (FC.BATTERY_STATE.cellCount == 0) {
                $('.vbatcalibration').hide();
                $('.amperagecalibration').hide();
                $('.calibrate').hide();
                $('.nocalib').show();
            } else {
                $('.calibrate').show();
                $('.nocalib').hide();
            }
            if (sourceschanged) {
                $('.srcchange').show();
                $('.vbatcalibration').hide();
                $('.amperagecalibration').hide();
                $('.calibrate').hide();
                $('.nocalib').hide();
            } else {
                $('.srcchange').hide();
            }
        });

        $('input[name="vbatcalibration"]').val(0);
        $('input[name="amperagecalibration"]').val(0);

        let vbatscalechanged = false;
        let amperagescalechanged = false;

        $('a.calibrate').click(function() {
            if (FC.BATTERY_CONFIG.voltageMeterSource == 1) {
                const vbatcalibration = parseFloat($('input[name="vbatcalibration"]').val());
                if (vbatcalibration != 0) {
                    const vbatnewscale = Math.round(FC.VOLTAGE_METER_CONFIGS[0].vbatscale * (vbatcalibration / FC.VOLTAGE_METERS[0].voltage));
                    if (vbatnewscale >= 10 && vbatnewscale <= 255) {
                        FC.VOLTAGE_METER_CONFIGS[0].vbatscale = vbatnewscale;
                        vbatscalechanged = true;
                    }
                }
            }
            const ampsource = FC.BATTERY_CONFIG.currentMeterSource;
            if (ampsource == 1 || ampsource == 2) {
                const amperagecalibration = parseFloat($('input[name="amperagecalibration"]').val());
                const amperageoffset = FC.CURRENT_METER_CONFIGS[ampsource - 1].offset / 1000;
                if (amperagecalibration != 0) {
                    if (FC.CURRENT_METERS[ampsource - 1].amperage != amperageoffset && amperagecalibration != amperageoffset) {
                        const amperagenewscale = Math.round(FC.CURRENT_METER_CONFIGS[ampsource - 1].scale *
                            ((FC.CURRENT_METERS[ampsource - 1].amperage -  amperageoffset) / (amperagecalibration - amperageoffset)));
                        if (amperagenewscale > -16000 && amperagenewscale < 16000 && amperagenewscale != 0) {
                            FC.CURRENT_METER_CONFIGS[ampsource - 1].scale = amperagenewscale;
                            amperagescalechanged = true;
                        }
                    }
                }
            }
            if (vbatscalechanged || amperagescalechanged) {
                if (vbatscalechanged) {
                    $('.vbatcalibration').show();
                } else {
                    $('.vbatcalibration').hide();
                }
                if (amperagescalechanged) {
                    $('.amperagecalibration').show();
                } else {
                    $('.amperagecalibration').hide();
                }

                $('output[name="vbatnewscale"').val(vbatnewscale).change();
                $('output[name="amperagenewscale"').val(amperagenewscale).change();

                $('a.applycalibration').click(function() {
                    if (vbatscalechanged) {
                        self.analyticsChanges['PowerVBatUpdated'] = 'Calibrated';
                    }

                    if (amperagescalechanged) {
                        self.analyticsChanges['PowerAmperageUpdated'] = 'Calibrated';
                    }

                    calibrationconfirmed = true;
                    GUI.calibrationManagerConfirmation.close();
                    updateDisplay(FC.VOLTAGE_METER_CONFIGS, FC.CURRENT_METER_CONFIGS);
                    $('.calibration').hide();
                });

                $('a.discardcalibration').click(function() {
                    GUI.calibrationManagerConfirmation.close();
                });
            } else {
                GUI.calibrationManagerConfirmation.close();
            }
        });

        self.save = function (callback) {
            updateData();
            save_data(callback);
        };

        self.revert = function (callback) {
            callback();
        };

        $('a.save').click(function () {
            self.save(() => GUI.tab_switch_reload());
        });

        $('a.revert').click(function () {
            self.revert(() => GUI.tab_switch_reload());
        });

        $('.content_wrapper').change(function () {
            setDirty();
        });

        GUI.interval_add('setup_data_pull_slow', get_slow_data, 200, true); // 5hz
    }

    function process_html() {
        initDisplay();

        // translate to user-selected language
        i18n.localizePage();

        GUI.content_ready(callback);
    }
};

TABS.power.cleanup = function (callback) {
    if (GUI.calibrationManager) {
        GUI.calibrationManager.destroy();
    }
    if (GUI.calibrationManagerConfirmation) {
        GUI.calibrationManagerConfirmation.destroy();
    }

    this.isDirty = false;

    if (callback) callback();
};
