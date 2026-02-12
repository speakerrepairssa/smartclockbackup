// Init plugin

// overall save the current selected window
var g_iWndIndex = 0; //don't have to set the variable; default to use the current selected window without transmiting value when the interface has window parameters
var g_oLocalConfig = null; //local configuration variable

//Error Code
var ERROR_CODE_UNKNOWN = 1000;
var ERROR_CODE_NETWORKERROR = 1001;
var ERROR_CODE_PARAMERROR = 1002;

//login
var ERROR_CODE_LOGIN_NOLOGIN = 2000;
var ERROR_CODE_LOGIN_REPEATLOGIN = 2001;
var ERROR_CODE_LOGIN_NOSUPPORT = 2002;

//preview and playback
var ERROR_CODE_PLAY_PLUGININITFAIL = 3000;
var ERROR_CODE_PLAY_NOREPEATPLAY = 3001;
var ERROR_CODE_PLAY_PLAYBACKABNORMAL = 3002;
var ERROR_CODE_PLAY_PLAYBACKSTOP = 3003;
var ERROR_CODE_PLAY_NOFREESPACE = 3004;

//talk
var ERROR_CODE_TALK_FAIL = 5000;


var version="V3.3.0build20230322"
$(function () {
    // Init plugin parameters and insert the plugin
    WebVideoCtrl.I_InitPlugin({
        bWndFull: true, //Wether support doule clicking to switch the full-screen mode: it's supported by default; true:support, false:not support
        iWndowType: 1,
        cbSelWnd: function (xmlDoc) {
            g_iWndIndex = parseInt($(xmlDoc).find("SelectWnd").eq(0).text(), 10);
            var szInfo = "the selected window index: " + g_iWndIndex;
            showCBInfo(szInfo);
        },
        cbDoubleClickWnd: function (iWndIndex, bFullScreen) {
            var szInfo = "present window number to zoom: " + iWndIndex;
            if (!bFullScreen) {            
                szInfo = "present window number to restore: " + iWndIndex;
            }
            showCBInfo(szInfo);
        },
        cbEvent: function (iEventType, iParam1, iParam2) {
            if (2 == iEventType) {
                showCBInfo("window " + iParam1 + "playback finished!");
            } else if (-1 == iEventType) {
                showCBInfo("device " + iParam1 + "network error!");
            } else if (3001 == iEventType) {
                clickStopRecord(g_szRecordType, iParam1);
            }
        },
        cbInitPluginComplete: function () {
            WebVideoCtrl.I_InsertOBJECTPlugin("divPlugin").then(() => {
                WebVideoCtrl.I_CheckPluginVersion().then((bFlag) => {
                    if (bFlag) {
                        alert("Detect the latest version, please double click HCWebSDKPlugin.exe to update!");
                    }
                });
            }, () => {
                alert("The plugin initialization failed. Please confirm if the plugin has been installed; If not installed, please double click on HCWebSDKPlugin.exe to install it!");
            });
        }
    });

    // window event binding
    $(window).bind({
        resize: function () {
            //WebVideoCtrl.I_Resize($("body").width(), $("body").height());
        }
    });

    //init date
    var szCurTime = dateFormat(new Date(), "yyyy-MM-dd");
    $("#starttime").val(szCurTime + " 00:00:00");
    $("#endtime").val(szCurTime + " 23:59:59");
    $("#downloadstarttime").val(szCurTime + " 00:00:00");
    $("#downloadendtime").val(szCurTime + " 23:59:59");
});

// display operation info
function showOPInfo(szInfo, status, xmlDoc) {
    var szTip = "<div>" + dateFormat(new Date(), "yyyy-MM-dd hh:mm:ss") + " " + szInfo;
    if (typeof status != "undefined" && status != 200) {
        var szStatusString = $(xmlDoc).find("statusString").eq(0).text();
        var szSubStatusCode = $(xmlDoc).find("subStatusCode").eq(0).text();
        if ("" === szSubStatusCode) {
            if("" === szSubStatusCode && "" === szStatusString){
                szTip += "(" + status + ")";
            }
            else{
                szTip += "(" + status + ", " + szStatusString + ")";
            }
        } else {
            szTip += "(" + status + ", " + szSubStatusCode + ")";
        }
    }
    szTip += "</div>";

    $("#opinfo").html(szTip + $("#opinfo").html());
}

// display callback info
function showCBInfo(szInfo) {
    szInfo = "<div>" + dateFormat(new Date(), "yyyy-MM-dd hh:mm:ss") + " " + szInfo + "</div>";
    $("#cbinfo").html(szInfo + $("#cbinfo").html());
}

// time format
function dateFormat(oDate, fmt) {
    var o = {
        "M+": oDate.getMonth() + 1, //month
        "d+": oDate.getDate(), //day
        "h+": oDate.getHours(), //hour
        "m+": oDate.getMinutes(), //minute
        "s+": oDate.getSeconds(), //second
        "q+": Math.floor((oDate.getMonth() + 3) / 3), //quarter
        "S": oDate.getMilliseconds()//millisecond
    };
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (oDate.getFullYear() + "").substr(4 - RegExp.$1.length));
    }
    for (var k in o) {
        if (new RegExp("(" + k + ")").test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        }
    }
    return fmt;
}

// get window size
function getWindowSize() {
    var nWidth = $(this).width() + $(this).scrollLeft(),
        nHeight = $(this).height() + $(this).scrollTop();

    return {width: nWidth, height: nHeight};
}

// open option dialog 0: folder, 1: file 
function clickOpenFileDlg(id, iType) {
    WebVideoCtrl.I_OpenFileDlg(iType).then(function(szDirPath){
        if (szDirPath != -1 && szDirPath != "" && szDirPath != null) {
            $("#" + id).val(szDirPath);
        }
    }, function() {
        showOPInfo("Failed to open file path.");
    });
}

// get local parameters
function clickGetLocalCfg() {
    WebVideoCtrl.I_GetLocalCfg().then((oLocalConfig) => {
        g_oLocalConfig = oLocalConfig;
        $("#netsPreach").val(oLocalConfig.buffNumberType);
        $("#wndSize").val(oLocalConfig.playWndType);
        $("#rulesInfo").val(oLocalConfig.ivsMode);
        $("#captureFileFormat").val(oLocalConfig.captureFileFormat);
        $("#packSize").val(oLocalConfig.packgeSize);
        $("#recordPath").val(oLocalConfig.recordPath);
        $("#downloadPath").val(oLocalConfig.downloadPath);
        $("#previewPicPath").val(oLocalConfig.capturePath);
        $("#playbackPicPath").val(oLocalConfig.playbackPicPath);
        $("#devicePicPath").val(oLocalConfig.deviceCapturePath);
        $("#playbackFilePath").val(oLocalConfig.playbackFilePath);
        $("#protocolType").val(oLocalConfig.protocolType);
        $("#secretKey").val("\x7F\x7F\x7F\x7F\x7F\x7F\x7F\x7F");
        showOPInfo("Get local configuration success.");
    }, (oError) => {
        var szInfo = "Get local configuration failed.";
        showOPInfo(szInfo, oError.errorCode, oError.errorMsg);
    });
}

// set local parameters
async function clickSetLocalCfg() {
    g_oLocalConfig.buffNumberType = $("#netsPreach").val();
    g_oLocalConfig.playWndType = $("#wndSize").val();
    g_oLocalConfig.ivsMode = $("#rulesInfo").val();
    g_oLocalConfig.captureFileFormat = $("#captureFileFormat").val();
    g_oLocalConfig.packgeSize = $("#packSize").val();
    g_oLocalConfig.recordPath = $("#recordPath").val();
    g_oLocalConfig.downloadPath = $("#downloadPath").val();
    g_oLocalConfig.capturePath = $("#previewPicPath").val();
    g_oLocalConfig.playbackPicPath = $("#playbackPicPath").val();
    g_oLocalConfig.deviceCapturePath = $("#devicePicPath").val();
    g_oLocalConfig.playbackFilePath = $("#playbackFilePath").val();
    g_oLocalConfig.protocolType = $("#protocolType").val();
    if ("\x7F\x7F\x7F\x7F\x7F\x7F\x7F\x7F" !== $("#secretKey").val()) {
        g_oLocalConfig.secretKey = await WebVideoCtrl.I_GetEncryptString($("#secretKey").val());
    }
    WebVideoCtrl.I_SetLocalCfg(g_oLocalConfig).then(() => {
        showOPInfo("Set local configuration success.");
    }, (oError) => {
        var szInfo = "Set local configuration failed.";
        showOPInfo(szInfo, oError.errorCode, oError.errorMsg);
    });
}

// windows number
function changeWndNum(iType) {
    iType = parseInt(iType, 10);
    WebVideoCtrl.I_ChangeWndNum(iType).then(() => {
        showOPInfo("Change window number successful!");
    }, (oError) => {
        var szInfo = "Change window number failed!";
        showOPInfo(szInfo, oError.errorCode, oError.errorMsg);
    });
}

// login
function clickLogin() {
    var szIP = $("#loginip").val(),
        szPort = $("#port").val(),
        szUsername = $("#username").val(),
        szPassword = $("#password").val();

    if ("" == szIP || "" == szPort) {
        return;
    }

    var szDeviceIdentify = szIP + "_" + szPort;

    WebVideoCtrl.I_Login(szIP, 1, szPort, szUsername, szPassword, {
        timeout: 3000,
        success: function (xmlDoc) {            
            showOPInfo(szDeviceIdentify + " login successful");
            $("#ip").prepend("<option value='" + szDeviceIdentify + "'>" + szDeviceIdentify + "</option>");
            setTimeout(function () {
                $("#ip").val(szDeviceIdentify);
                setTimeout(function() {
                    getChannelInfo();
                }, 1000);
                getDevicePort();
            }, 10);
        },
        error: function (oError) {
            if (ERROR_CODE_LOGIN_REPEATLOGIN === status) {
                showOPInfo(szDeviceIdentify + " is already login");
            } else {
                showOPInfo(szDeviceIdentify + " login failed", oError.errorCode, oError.errorMsg);
            }
        }
    });
}

//logout
function clickLogout() {
    var szDeviceIdentify = $("#ip").val();

    if (null == szDeviceIdentify) {
        return;
    }

    WebVideoCtrl.I_Logout(szDeviceIdentify).then(() => {
        showOPInfo(szDeviceIdentify + " " + "logout successful");
   }, () => {
    showOPInfo(szDeviceIdentify + " " + "logout failed");
   });
}

// get deivce info
function clickGetDeviceInfo() {
    var szDeviceIdentify = $("#ip").val();

    if (null == szDeviceIdentify) {
        return;
    }

    WebVideoCtrl.I_GetDeviceInfo(szDeviceIdentify, {
        success: function (xmlDoc) {
            var arrStr = [];
            arrStr.push("device name: " + $(xmlDoc).find("deviceName").eq(0).text() + "\r\n");
            arrStr.push("device ID: " + $(xmlDoc).find("deviceID").eq(0).text() + "\r\n");
            arrStr.push("model: " + $(xmlDoc).find("model").eq(0).text() + "\r\n");
            arrStr.push("serial number: " + $(xmlDoc).find("serialNumber").eq(0).text() + "\r\n");
            arrStr.push("MAC address: " + $(xmlDoc).find("macAddress").eq(0).text() + "\r\n");
            arrStr.push("firmware version: " + $(xmlDoc).find("firmwareVersion").eq(0).text() + " " + $(xmlDoc).find("firmwareReleasedDate").eq(0).text() + "\r\n");
            arrStr.push("encoder version: " + $(xmlDoc).find("encoderVersion").eq(0).text() + " " + $(xmlDoc).find("encoderReleasedDate").eq(0).text() + "\r\n");
            
            showOPInfo(szDeviceIdentify + " get deivce info success.");
            alert(arrStr.join(""));
        },
        error: function (oError) {
            showOPInfo(szDeviceIdentify + " get device info failed ", oError.errorCode, oError.errorMsg);
        }
    });
}

// get channel info
function getChannelInfo() {
    var szDeviceIdentify = $("#ip").val(),
        oSel = $("#channels").empty();

    if (null == szDeviceIdentify) {
        return;
    }

    // analog channel
    WebVideoCtrl.I_GetAnalogChannelInfo(szDeviceIdentify, {
        success: function (xmlDoc) {
            var oChannels = $(xmlDoc).find("VideoInputChannel");

            $.each(oChannels, function (i) {
                var id = $(this).find("id").eq(0).text(),
                    name = $(this).find("name").eq(0).text();
                if ("" == name) {
                    name = "Camera " + (i < 9 ? "0" + (i + 1) : (i + 1));
                }
                oSel.append("<option value='" + id + "' bZero='false'>" + name + "</option>");
            });
            showOPInfo(szDeviceIdentify + " get analog channel success.");
        },
        error: function (oError) {
            showOPInfo(szDeviceIdentify + " get analog channel failed ", oError.errorCode, oError.errorMsg);
        }
    });
    // IP channel
    WebVideoCtrl.I_GetDigitalChannelInfo(szDeviceIdentify, {
        success: function (xmlDoc) {
            var oChannels = $(xmlDoc).find("InputProxyChannelStatus");

            $.each(oChannels, function (i) {
                var id = $(this).find("id").eq(0).text(),
                    name = $(this).find("name").eq(0).text(),
                    online = $(this).find("online").eq(0).text();
                if ("false" == online) {
                    return true;
                }
                if ("" == name) {
                    name = "IPCamera " + (i < 9 ? "0" + (i + 1) : (i + 1));
                }
                oSel.append("<option value='" + id + "' bZero='false'>" + name + "</option>");
            });
            showOPInfo(szDeviceIdentify + " get IP channel success.");
        },
        error: function (oError) {
            showOPInfo(szDeviceIdentify + " get IP channel failed ", oError.errorCode, oError.errorMsg);
        }
    });
    // zero-channel info
    WebVideoCtrl.I_GetZeroChannelInfo(szDeviceIdentify, {
        success: function (xmlDoc) {
            var oChannels = $(xmlDoc).find("ZeroVideoChannel");
            
            $.each(oChannels, function (i) {
                var id = $(this).find("id").eq(0).text(),
                    name = $(this).find("name").eq(0).text();
                if ("" == name) {
                    name = "Zero Channel " + (i < 9 ? "0" + (i + 1) : (i + 1));
                }
                if ("true" == $(this).find("enabled").eq(0).text()) {
                    oSel.append("<option value='" + id + "' bZero='true'>" + name + "</option>");
                }
            });
            showOPInfo(szDeviceIdentify + " get zero-channel success.");
        },
        error: function (oError) {
            showOPInfo(szDeviceIdentify + " get zero-channel failed ", oError.errorCode, oError.errorMsg);
        }
    });
}

//get port
function getDevicePort() {
    var szDeviceIdentify = $("#ip").val();

    if (null == szDeviceIdentify) {
        return;
    }

    WebVideoCtrl.I_GetDevicePort(szDeviceIdentify).then((oPort) => {
        $("#deviceport").val(oPort.iDevicePort);
        $("#rtspport").val(oPort.iRtspPort);

        showOPInfo(szDeviceIdentify + " get port success.");
    }, (oError) => {
        var szInfo = "get port failed.";
        showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
    });
}

// get IP channel
async function clickGetDigitalChannelInfo() {
    var szDeviceIdentify = $("#ip").val(),
        iAnalogChannelNum = 0;

    $("#digitalchannellist").empty();

    if (null == szDeviceIdentify) {
        return;
    }

    try {
        var oAnalogChannelInfo = await WebVideoCtrl.I_GetAnalogChannelInfo(szDeviceIdentify, {});
        iAnalogChannelNum = $(oAnalogChannelInfo).find("VideoInputChannel").length;
    } finally {
        WebVideoCtrl.I_GetDigitalChannelInfo(szDeviceIdentify, {
            success: function (xmlDoc) {
                var oChannels = $(xmlDoc).find("InputProxyChannelStatus");
                
                $.each(oChannels, function () {
                    var id = parseInt($(this).find("id").eq(0).text(), 10),
                        ipAddress = $(this).find("ipAddress").eq(0).text(),
                        srcInputPort = $(this).find("srcInputPort").eq(0).text(),
                        managePortNo = $(this).find("managePortNo").eq(0).text(),
                        online = $(this).find("online").eq(0).text(),
                        proxyProtocol = $(this).find("proxyProtocol").eq(0).text();
                                
                    var objTr = $("#digitalchannellist").get(0).insertRow(-1);
                    var objTd = objTr.insertCell(0);
                    objTd.innerHTML = (id - iAnalogChannelNum) < 10 ? "D0" + (id - iAnalogChannelNum) : "D" + (id - iAnalogChannelNum);
                    objTd = objTr.insertCell(1);
                    objTd.width = "25%";
                    objTd.innerHTML = ipAddress;
                    objTd = objTr.insertCell(2);
                    objTd.width = "15%";
                    objTd.innerHTML = srcInputPort;
                    objTd = objTr.insertCell(3);
                    objTd.width = "20%";
                    objTd.innerHTML = managePortNo;
                    objTd = objTr.insertCell(4);
                    objTd.width = "15%";
                    objTd.innerHTML = "true" == online ? "online" : "offline";
                    objTd = objTr.insertCell(5);
                    objTd.width = "25%";
                    objTd.innerHTML = proxyProtocol;
                });
                showOPInfo(szDeviceIdentify + " get IP channel success.");
            },
            error: function (oError) {
                showOPInfo(szDeviceIdentify + " no IP channel ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}
// strat real play
function clickStartRealPlay(iStreamType) {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szDeviceIdentify = $("#ip").val(),
        iRtspPort = parseInt($("#rtspport").val(), 10),
        iChannelID = parseInt($("#channels").val(), 10),
        bZeroChannel = $("#channels option").eq($("#channels").get(0).selectedIndex).attr("bZero") == "true" ? true : false,
        szInfo = "";

    if ("undefined" === typeof iStreamType) {
        iStreamType = parseInt($("#streamtype").val(), 10);
    }

    if (null == szDeviceIdentify) {
        return;
    }
    var startRealPlay = function () {
        WebVideoCtrl.I_StartRealPlay(szDeviceIdentify, {
            iStreamType: iStreamType,
            iChannelID: iChannelID,
            bZeroChannel: bZeroChannel,
            success: function () {
                szInfo = "start real play success.";
                showOPInfo(szDeviceIdentify + " " + szInfo);               
            },
            error: function (oError) {
                showOPInfo(szDeviceIdentify + " start real play failed ", oError.errorCode, oError.errorMsg);
            }
        });
    };
   
    if (oWndInfo != null) {
        WebVideoCtrl.I_Stop({
            success: function () {
                startRealPlay();
            }
        });
    } else {
        startRealPlay();
    }
}
function setTextOverlay() {
    var  szDeviceIdentify = $("#ip").val();
    var szInfo = "";
    var that = this;
    var iChannelID = parseInt($("#channels").val(), 10);
    var szUrl = "ISAPI/System/Video/inputs/channels/" + iChannelID + "/overlays";
        WebVideoCtrl.I_GetTextOverlay(szUrl,szDeviceIdentify,{
            success:function(data){
            $(data).find("TextOverlay").eq(0).find("displayText").eq(0).text("test");
            $(data).find("TextOverlay").eq(0).find("positionX").eq(0).text("20");
            $(data).find("TextOverlay").eq(0).find("positionY").eq(0).text("30");
            var xmldoc = toXMLStr(data);
            var newOptions = {
                type: "PUT",
                data: xmldoc,
                success: function(){
                    szInfo = "set osd info successful";
                    showOPInfo(szDeviceIdentify + " " + szInfo);
                },
                error: function(oError){
                    showOPInfo(szDeviceIdentify + " set osd info failed", oError.errorCode, oError.errorMsg);
                }
            };
           
            WebVideoCtrl.I_SendHTTPRequest(szDeviceIdentify,szUrl,newOptions);
        },
        error: function(oError){
            showOPInfo(szDeviceIdentify + " set osd info failed ", oError.errorCode, oError.errorMsg);
        }
    });
}
// stop real play
function clickStopRealPlay() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_Stop({
            success: function () {
                szInfo = "stop real play success.";
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                showOPInfo(szDeviceIdentify + " stop real play failed ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// open sound
function clickOpenSound() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        var allWndInfo = WebVideoCtrl.I_GetWindowStatus();
        for (var i = 0, iLen = allWndInfo.length; i < iLen; i++) {
            oWndInfo = allWndInfo[i];
            if (oWndInfo.bSound) {
                WebVideoCtrl.I_CloseSound(oWndInfo.iIndex);
                break;
            }
        }

        WebVideoCtrl.I_OpenSound().then(() => {
            showOPInfo(oWndInfo.szDeviceIdentify + " " + "open sound successful.");
        }, (oError) => {           
            var szInfo = " open sound failed ";
            showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// close sound
function clickCloseSound() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_CloseSound().then(() => {
            showOPInfo(oWndInfo.szDeviceIdentify + " " + "close sound success.");
        }, (oError) => {
            var szInfo = " close sound failed.";
            showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// set volume
function clickSetVolume() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        iVolume = parseInt($("#volume").val(), 10),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_SetVolume(iVolume).then(() => {
            showOPInfo(oWndInfo.szDeviceIdentify + " " + "set volume success.");
        }, (oError) => {
            var szInfo = " set volume failed ";
            showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// capture
async function clickCapturePic(szType) {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        var oLocalConfig = await WebVideoCtrl.I_GetLocalCfg();
        var szCaptureFileFormat = "0";
        if (oLocalConfig) {
            szCaptureFileFormat = oLocalConfig.captureFileFormat;
        }

        var szChannelID = $("#channels").val();
        var szPicName = oWndInfo.szDeviceIdentify + "_" + szChannelID + "_" + new Date().getTime();
        if ("playback" === szType) {
            szPicName = "playback_" + oWndInfo.szDeviceIdentify + "_" + szChannelID + "_" + new Date().getTime();
        }
        
        szPicName += ("0" === szCaptureFileFormat) ? ".jpg": ".bmp";

        WebVideoCtrl.I_CapturePic(szPicName, {
            bDateDir: true
        }).then(function(){
            szInfo = "capture success.";
            showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
        }, function(oError){
            szInfo = " capture failed ";
            showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}
// capture data
function clickCapturePicData() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";
    if (oWndInfo != null) {
        WebVideoCtrl.I_CapturePicData().then(function(data){
            console.log(data);
            szInfo = "get capture data success.";
            showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
        },function(){
            szInfo = "get capture data failed.";
            showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
        });
    }
}

// start record
var g_szRecordType = "";
function clickStartRecord(szType) {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    g_szRecordType = szType;

    if (oWndInfo != null) {
        var szChannelID = $("#channels").val(),
            szFileName = oWndInfo.szDeviceIdentify + "_" + szChannelID + "_" + new Date().getTime();

        WebVideoCtrl.I_StartRecord(szFileName, {
            bDateDir: true,
            success: function () {
                if ('realplay' === szType) {
                    szInfo = "start recording success.";
                } else if ('playback' === szType) {
                    szInfo = "start clip success.";
                }
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                if ('realplay' === szType) {
                    szInfo = " start recording failed.";
                } else if ('playback' === szType) {
                    szInfo = " start clip failed.";
                }
                showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// stop record
function clickStopRecord(szType, iWndIndex) {
    if ("undefined" === typeof iWndIndex) {
        iWndIndex = g_iWndIndex;
    }
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_StopRecord({
            success: function () {
                if ('realplay' === szType) {
                    szInfo = "stop recording success.";
                } else if ('playback' === szType) {
                    szInfo = "stop clip success.";
                }
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                if ('realplay' === szType) {
                    szInfo = "stop recording failed.";
                } else if ('playback' === szType) {
                    szInfo = "stop clip failed.";
                }
                sshowOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// get audio channel
function clickGetAudioInfo() {
    var szDeviceIdentify = $("#ip").val();

    if (null == szDeviceIdentify) {
        return;
    }

    WebVideoCtrl.I_GetAudioInfo(szDeviceIdentify, {
        success: function (xmlDoc) {
            var oAudioChannels = $(xmlDoc).find("TwoWayAudioChannel"),
                oSel = $("#audiochannels").empty();
            $.each(oAudioChannels, function () {
                var id = $(this).find("id").eq(0).text();

                oSel.append("<option value='" + id + "'>" + id + "</option>");
            });
            showOPInfo(szDeviceIdentify + " get audio channel success.");
        },
        error: function (oError) {
            showOPInfo(szDeviceIdentify + " get audio channel failed ", oError.errorCode, oError.errorMsg);
        }
    });
}

// start voice talk
function clickStartVoiceTalk() {
    var szDeviceIdentify = $("#ip").val(),
        iAudioChannel = parseInt($("#audiochannels").val(), 10),
        szInfo = "";

    if (null == szDeviceIdentify) {
        return;
    }

    if (isNaN(iAudioChannel)) {
        alert("please select channel first.");
        return;
    }

    WebVideoCtrl.I_StartVoiceTalk(szDeviceIdentify, iAudioChannel).then(() => {
        szInfo = "start voice talk success.";
        showOPInfo(szDeviceIdentify + " " + szInfo);
    }, (oError) => {
        var szInfo = " start voice talk failed ";
        showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
    });
}

// stop voice talk
function clickStopVoiceTalk() {
    var szDeviceIdentify = $("#ip").val();
    WebVideoCtrl.I_StopVoiceTalk().then(() => {
        szInfo = "stop voice talk success.";
        showOPInfo(szDeviceIdentify + " " + szInfo);
    }, (oError) => {
        var szInfo = " stop voice talk failed.";
        showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
    });
}

// enable E-zoom
function clickEnableEZoom() {
    var szDeviceIdentify = $("#ip").val();
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
            WebVideoCtrl.I_EnableEZoom().then(() => {
            szInfo = "enable E-zoom success.";
            showOPInfo(szDeviceIdentify + " " + szInfo);
        }, (oError) => {
            szInfo = "enable E-zoom failed ";
            showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);

        });
    }
}

//disable E-zoom
function clickDisableEZoom() {
    var szDeviceIdentify = $("#ip").val();
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_DisableEZoom().then(() => {
            szInfo = "disable E-zoom success.";
            showOPInfo(szDeviceIdentify + " " + szInfo);
        }, (oError) => {
            szInfo = "disable E-zoom failed ";
            showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// nable 3D zoom
function clickEnable3DZoom() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";
    var szDeviceIdentify = $("#ip").val();

    if (oWndInfo != null) {
        WebVideoCtrl.I_Enable3DZoom().then(() => {
            szInfo = "enable 3D zoom success.";
            showOPInfo(szDeviceIdentify + " " + szInfo);
        }, (oError) => {
            szInfo = "enable 3D zoom failed ";
            showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// diasble 3D zoom
function clickDisable3DZoom() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";
    var szDeviceIdentify = $("#ip").val();

    if (oWndInfo != null) {
        WebVideoCtrl.I_Disable3DZoom().then(() => {
            szInfo = "diasble 3D zoom success.";
            showOPInfo(szDeviceIdentify + " " + szInfo);
        }, (oError) => {
            szInfo = "diasble 3D zoom failed ";
            showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// full screen
function clickFullScreen() {
    WebVideoCtrl.I_FullScreen(true).then(() => {
        showOPInfo(" full screen success.");
    }, (oError) => {
        showOPInfo("full screen failed ", oError.errorCode, oError.errorMsg);
    });
}

// PTZ control, 9- auto; 1,2,3,4,5,6,7,8 -  PTZ direction control by mouse
var g_bPTZAuto = false;
function mouseDownPTZControl(iPTZIndex) {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        bZeroChannel = $("#channels option").eq($("#channels").get(0).selectedIndex).attr("bZero") == "true" ? true : false,
        iPTZSpeed = $("#ptzspeed").val();

    if (bZeroChannel) {// zero-channel does not support PTZ 
        return;
    }
    
    if (oWndInfo != null) {
        if (9 == iPTZIndex && g_bPTZAuto) {
            iPTZSpeed = 0;// you can close auto mode by setting speed to 0 when auto is start already
        } else {
            g_bPTZAuto = false;// auto mode will be close when you clik other direction
        }

        WebVideoCtrl.I_PTZControl(iPTZIndex, false, {
            iPTZSpeed: iPTZSpeed,
            success: function (xmlDoc) {
                if (9 == iPTZIndex && g_bPTZAuto) {
                    showOPInfo(oWndInfo.szDeviceIdentify + " stop PTZ success.");
                } else {
                    showOPInfo(oWndInfo.szDeviceIdentify + " start PTZ success.");
                }
                if (9 == iPTZIndex) {
                    g_bPTZAuto = !g_bPTZAuto;
                }
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " start PTZ failed ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// stop PTZ direction 
function mouseUpPTZControl() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(1, true, {
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " stop PTZ direction successful.");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " stop PTZ direction failed ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// set preset
function clickSetPreset() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        iPresetID = parseInt($("#preset").val(), 10);

    if (oWndInfo != null) {
        WebVideoCtrl.I_SetPreset(iPresetID, {
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " set preset success.");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " set preset failed.", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// call preset
function clickGoPreset() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        iPresetID = parseInt($("#preset").val(), 10);

    if (oWndInfo != null) {
        WebVideoCtrl.I_GoPreset(iPresetID, {
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " call preset successful.");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " call preset failed ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// record searching
var g_iSearchTimes = 0;
function clickRecordSearch(iType) {
    var szDeviceIdentify = $("#ip").val(),
        iChannelID = parseInt($("#channels").val(), 10),
        bZeroChannel = $("#channels option").eq($("#channels").get(0).selectedIndex).attr("bZero") == "true" ? true : false,
        iStreamType = parseInt($("#record_streamtype").val(), 10),
        szStartTime = $("#starttime").val(),
        szEndTime = $("#endtime").val();
        if (Date.parse(szEndTime.replace(/-/g, "/")) - Date.parse(szStartTime.replace(/-/g, "/")) < 0) {
            alert("starttime must earlier than endtime");
            return;
        }
    if (null == szDeviceIdentify) {
        return;
    }

    if (bZeroChannel) {// ero-channel does not support record searching
        return;
    }

    if (0 == iType) {// search for the first time
        $("#searchlist").empty();
        g_iSearchTimes = 0;
    }

    WebVideoCtrl.I_RecordSearch(szDeviceIdentify, iChannelID, szStartTime, szEndTime, {
        iStreamType: iStreamType,
        iSearchPos: g_iSearchTimes,
        success: function (xmlDoc) {
            if ("MORE" === $(xmlDoc).find("responseStatusStrg").eq(0).text()) {
                for(var i = 0, nLen = $(xmlDoc).find("searchMatchItem").length; i < nLen; i++) {                    
                    var szPlaybackURI = $(xmlDoc).find("playbackURI").eq(i).text();
                    if(szPlaybackURI.indexOf("name=") < 0) {
                        break;
                    }
                    var szStartTime = $(xmlDoc).find("startTime").eq(i).text();
                    var szEndTime = $(xmlDoc).find("endTime").eq(i).text();
                    var szFileName = szPlaybackURI.substring(szPlaybackURI.indexOf("name=") + 5, szPlaybackURI.indexOf("&size="));

                    var objTr = $("#searchlist").get(0).insertRow(-1);
                    var objTd = objTr.insertCell(0);
                    objTd.id = "downloadTd" + i;
                    objTd.innerHTML = g_iSearchTimes + 1;
                    objTd = objTr.insertCell(1);
                    objTd.width = "30%";
                    objTd.innerHTML = szFileName;
                    objTd = objTr.insertCell(2);
                    objTd.width = "30%";
                    objTd.innerHTML = (szStartTime.replace("T", " ")).replace("Z", "");
                    objTd = objTr.insertCell(3);
                    objTd.width = "30%";
                    objTd.innerHTML = (szEndTime.replace("T", " ")).replace("Z", "");
                    objTd = objTr.insertCell(4);
                    objTd.width = "10%";
                    objTd.innerHTML = "<a href='javascript:;' onclick='clickStartDownloadRecord(" + g_iSearchTimes + ");'>download</a>";
                    $("#downloadTd" + g_iSearchTimes).data("fileName", szFileName);
                    $("#downloadTd" + g_iSearchTimes).data("playbackURI", szPlaybackURI);
                    ++g_iSearchTimes;
                }

                clickRecordSearch(1);
            } else if ("OK" === $(xmlDoc).find("responseStatusStrg").eq(0).text()) {
                var iLength = $(xmlDoc).find("searchMatchItem").length;
                for(var i = 0; i < iLength; i++) {
                    var szPlaybackURI = $(xmlDoc).find("playbackURI").eq(i).text();
                    if(szPlaybackURI.indexOf("name=") < 0) {
                        break;
                    }
                    var szStartTime = $(xmlDoc).find("startTime").eq(i).text();
                    var szEndTime = $(xmlDoc).find("endTime").eq(i).text();
                    var szFileName = szPlaybackURI.substring(szPlaybackURI.indexOf("name=") + 5, szPlaybackURI.indexOf("&size="));

                    var objTr = $("#searchlist").get(0).insertRow(-1);
                    var objTd = objTr.insertCell(0);
                    objTd.id = "downloadTd" + i;
                    objTd.innerHTML = g_iSearchTimes + 1;
                    objTd = objTr.insertCell(1);
                    objTd.width = "30%";
                    objTd.innerHTML = szFileName;
                    objTd = objTr.insertCell(2);
                    objTd.width = "30%";
                    objTd.innerHTML = (szStartTime.replace("T", " ")).replace("Z", "");
                    objTd = objTr.insertCell(3);
                    objTd.width = "30%";
                    objTd.innerHTML = (szEndTime.replace("T", " ")).replace("Z", "");
                    objTd = objTr.insertCell(4);
                    objTd.width = "10%";
                    objTd.innerHTML = "<a href='javascript:;' onclick='clickStartDownloadRecord(" + g_iSearchTimes + ");'>download</a>";
                    $("#downloadTd" + g_iSearchTimes).data("fileName", szFileName);
                    $("#downloadTd" + g_iSearchTimes).data("playbackURI", szPlaybackURI);
                    ++g_iSearchTimes;
                }
                showOPInfo(szDeviceIdentify + " search video file success.");
            } else if("NO MATCHES" === $(xmlDoc).find("responseStatusStrg").eq(0).text()) {
                setTimeout(function() {
                    g_iSearchTimes = 0;
                    showOPInfo(szDeviceIdentify + " no record file.");
                }, 50);
            }
        },
        error: function (oError) {
            g_iSearchTimes = 0;
            showOPInfo(szDeviceIdentify + " earch record file failed ", oError.errorCode, oError.errorMsg);
        }
    });
}

// start play back
function clickStartPlayback() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szDeviceIdentify = $("#ip").val(),
        iRtspPort = parseInt($("#rtspport").val(), 10),
        iStreamType = parseInt($("#record_streamtype").val(), 10),
        bZeroChannel = $("#channels option").eq($("#channels").get(0).selectedIndex).attr("bZero") == "true" ? true : false,
        iChannelID = parseInt($("#channels").val(), 10),
        szStartTime = $("#starttime").val(),
        szEndTime = $("#endtime").val(),
        szInfo = "",
        bChecked = $("#transstream").prop("checked"),
        iRet = -1;

    if (null == szDeviceIdentify) {
        return;
    }

    if (bZeroChannel) {// zero-channel does not support play back
        return;
    }

    var startPlayback = function () {
        if (bChecked) {
            var oTransCodeParam = {
                TransFrameRate: "16",// 0: full, 5: 1, 6: 2, 7: 4, 8: 6, 9: 8, 10: 10, 11: 12, 12: 16, 14: 15, 15: 18, 13: 20, 16: 22
                TransResolution: "2",// 255: Auto, 3: 4CIF, 2: QCIF, 1: CIF
                TransBitrate: "23"// 2: 32K, 3: 48K, 4: 64K, 5: 80K, 6: 96K, 7: 128K, 8: 160K, 9: 192K, 10: 224K, 11: 256K, 12: 320K, 13: 384K, 14: 448K, 15: 512K, 16: 640K, 17: 768K, 18: 896K, 19: 1024K, 20: 1280K, 21: 1536K, 22: 1792K, 23: 2048K, 24: 3072K, 25: 4096K, 26: 8192K
            };
            WebVideoCtrl.I_StartPlayback(szDeviceIdentify, {
                iRtspPort: iRtspPort,
                iStreamType: iStreamType,
                iChannelID: iChannelID,
                szStartTime: szStartTime,
                szEndTime: szEndTime,
                oTransCodeParam: oTransCodeParam,
                success: function () {
                    szInfo = "start playback success.";
                    showOPInfo(szDeviceIdentify + " " + szInfo);
                },
                error: function (oError) {
                    szInfo = "start playback failed ";
                    showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
                }
            });
        } else {
            WebVideoCtrl.I_StartPlayback(szDeviceIdentify, {
                iRtspPort: iRtspPort,
                iStreamType: iStreamType,
                iChannelID: iChannelID,
                szStartTime: szStartTime,
                szEndTime: szEndTime,
                success: function () {
                    szInfo = "start playback success.";
                    showOPInfo(szDeviceIdentify + " " + szInfo);
                },
                error: function (oError) {
                    szInfo = "start playback failed.";
                    showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
                }
            });
        }
    };

    if (oWndInfo != null) {
        WebVideoCtrl.I_Stop({
            success: function () {
                startPlayback();
            }
        });
    } else {
        startPlayback();
    }
}

// stop play back
function clickStopPlayback() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_Stop({
            success: function () {
                szInfo = "stop play back success.";
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                szInfo = "stop play back failed.";
                showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

//start reverse play
function clickReversePlayback() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szDeviceIdentify = $("#ip").val(),
        iRtspPort = parseInt($("#rtspport").val(), 10),
        iStreamType = parseInt($("#record_streamtype").val(), 10),
        bZeroChannel = $("#channels option").eq($("#channels").get(0).selectedIndex).attr("bZero") == "true" ? true : false,
        iChannelID = parseInt($("#channels").val(), 10),
        szStartTime = $("#starttime").val(),
        szEndTime = $("#endtime").val(),
        szInfo = "";

    if (null == szDeviceIdentify) {
        return;
    }

    if (bZeroChannel) {// zero-channel does not support reverse play
        return;
    }

    var reversePlayback = function () {
        WebVideoCtrl.I_ReversePlayback(szDeviceIdentify, {
            iRtspPort: iRtspPort,
            iStreamType: iStreamType,
            iChannelID: iChannelID,
            szStartTime: szStartTime,
            szEndTime: szEndTime
        }).then(() => {
            szInfo = "start reverse play success.";
            showOPInfo(szDeviceIdentify + " " + szInfo);
        }, (oError) => {
            szInfo = "start reverse play failed ";
            showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    };

    if (oWndInfo != null) {
        WebVideoCtrl.I_Stop({
            success: function () {
                reversePlayback();
            }
        });
    } else {
        reversePlayback();
    }
}

// single frame
function clickFrame() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_Frame({
            success: function () {
                szInfo = "single frame play success.";
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                szInfo = "single frame play failed ";
                showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// pause
function clickPause() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_Pause({
            success: function () {
                szInfo = "pause success.";
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                szInfo = "pause failed ";
                showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// resume
function clickResume() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_Resume({
            success: function () {
                szInfo = "resume success.";
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                szInfo = "resume failed ";
                showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// slow play
function clickPlaySlow() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_PlaySlow({
            success: function () {
                szInfo = "slow play success.";
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                szInfo = "slow play failed ";
                showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// fast play
function clickPlayFast() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_PlayFast({
            success: function () {
                szInfo = "fast play success.";
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                szInfo = "fast play failed ";
                showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// OSD time
function clickGetOSDTime() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);
    
    if (oWndInfo != null) {
        WebVideoCtrl.I_GetOSDTime({
            success: function (szOSDTime) {
                $("#osdtime").val(szOSDTime);
                showOPInfo(oWndInfo.szDeviceIdentify + " get OSD time success.");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " get OSD time failed ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// download video
var g_iDownloadID = -1;
var g_tDownloadProcess = 0;
function clickStartDownloadRecord(i) {
    var szDeviceIdentify = $("#ip").val(),
        szChannelID = $("#channels").val(),
        szFileName = $("#downloadTd" + i).data("fileName"),
        szPlaybackURI = $("#downloadTd" + i).data("playbackURI");

    if (null == szDeviceIdentify) {
        return;
    }

    WebVideoCtrl.I_StartDownloadRecord(szDeviceIdentify, szPlaybackURI, szFileName, {
        bDateDir: true
    }).then((iDownloadID) => {
        g_iDownloadID = iDownloadID;
        $("<div id='downProcess' class='freeze'></div>").appendTo("body");
        g_tDownloadProcess = setInterval("downProcess(" + i + ")", 1000);
    }, (oError) => {
        WebVideoCtrl.I_GetLastError().then((iErrorValue) => {
            if (34 == iErrorValue) {
                showOPInfo(szDeviceIdentify + " download already.");
            } else if (33 == iErrorValue) {
                showOPInfo(szDeviceIdentify + " lack of space.");
            } else {
                showOPInfo(szDeviceIdentify + " download failed.");
            }
        });
    });
}
function clickStartDownloadRecordByTime() {
    var szDeviceIdentify = $("#ip").val(),
        szChannelID = $("#channels").val(),
        szFileName = $("#downloadTd0").data("fileName"),
        szPlaybackURI = $("#downloadTd0").data("playbackURI"),
        szStartTime = $("#downloadstarttime").val(),
        szEndTime = $("#downloadendtime").val();
    if (null == szDeviceIdentify) {
        return;
    }
    if (Date.parse(szEndTime.replace(/-/g, "/")) - Date.parse(szStartTime.replace(/-/g, "/")) < 0) {
        alert("starttime must earlier than endtime");
        return;
    }
    WebVideoCtrl.I_StartDownloadRecordByTime(szDeviceIdentify, szPlaybackURI, szFileName, szStartTime,szEndTime,{
        bDateDir: true
    }).then((iDownloadID) => {
        g_iDownloadID = iDownloadID;
        $("<div id='downProcess' class='freeze'></div>").appendTo("body");
        g_tDownloadProcess = setInterval("downProcess(" + 0 + ")", 1000);
    }, (oError) => {
        showOPInfo(szDeviceIdentify + " Download Failed.");
    });
}

function clickStopDownload() {
    WebVideoCtrl.I_StopDownloadRecord(g_iDownloadID).then(() => {
        showOPInfo("stop download successful.");
        clearInterval(g_tDownloadProcess);
        g_tDownloadProcess = 0;
        g_iDownloadID = -1;
        $("#downProcess").remove();
    }, (oError) => {
        showOPInfo(szDeviceIdentify + " stop download failed ", oError.errorCode, oError.errorMsg);
    });
}
// download process
async function downProcess() {
    var iStatus = await WebVideoCtrl.I_GetDownloadStatus(g_iDownloadID);
    if (0 == iStatus) {
        $("#downProcess").css({
            width: $("#searchlist").width() + "px",
            height: "100px",
            lineHeight: "100px",
            left: $("#searchdiv").offset().left + "px",
            top: $("#searchdiv").offset().top + "px"
        });
        var iProcess = await WebVideoCtrl.I_GetDownloadProgress(g_iDownloadID);
        if (iProcess < 0) {
            clearInterval(g_tDownloadProcess);
            g_tDownloadProcess = 0;
            g_iDownloadID = -1;
        } else if (iProcess < 100) {
            $("#downProcess").text(iProcess + "%");
        } else {
            $("#downProcess").text("100%");
            setTimeout(function () {
                $("#downProcess").remove();
            }, 1000);

            await WebVideoCtrl.I_StopDownloadRecord(g_iDownloadID);

            showOPInfo("video dowload finish.");
            clearInterval(g_tDownloadProcess);
            g_tDownloadProcess = 0;
            g_iDownloadID = -1;
        }
    } else {
        await WebVideoCtrl.I_StopDownloadRecord(g_iDownloadID);

        clearInterval(g_tDownloadProcess);
        g_tDownloadProcess = 0;
        g_iDownloadID = -1;
    }
}

// reconnection
function reconnect(szDeviceIdentify) {
    WebVideoCtrl.I_Reconnect(szDeviceIdentify, {
        timeout: 3000,
        success: function (xmlDoc) {
            $("#restartDiv").remove();
        },
        error: function () {
            setTimeout(function () {reconnect(szDeviceIdentify);}, 5000);
        }
    });
}

// start upgrade
var g_tUpgrade = 0;
function clickStartUpgrade(szDeviceIdentify) {
    var szDeviceIdentify = $("#ip").val(),
        szFileName = $("#upgradeFile").val();

    if (null == szDeviceIdentify) {
        return;
    }

    if ("" == szFileName) {
        alert("please select upgrade file.");
        return;
    }
    WebVideoCtrl.I_StartUpgrade(szDeviceIdentify, szFileName).then(function(){
        g_tUpgrade = setInterval("getUpgradeStatus('" + szDeviceIdentify + "')", 1000);
    },function(){
        clearInterval(g_tUpgrade);
        showOPInfo(szDeviceIdentify + " upgrade failed.");
    });  
}

// get upgrade status
async function getUpgradeStatus(szDeviceIdentify) {
    var bUpdating = await WebVideoCtrl.I_UpgradeStatus(szDeviceIdentify);
    if (bUpdating) {
        var iProcess = await WebVideoCtrl.I_UpgradeProgress(szDeviceIdentify);
        if (iProcess < 0) {
            clearInterval(g_tUpgrade);
            g_tUpgrade = 0;
            showOPInfo(szDeviceIdentify + " get process failed.");
            return;
        } else if (iProcess < 100) {
            if (0 == $("#restartDiv").length) {
                $("<div id='restartDiv' class='freeze'></div>").appendTo("body");
                var oSize = getWindowSize();
                $("#restartDiv").css({
                    width: oSize.width + "px",
                    height: oSize.height + "px",
                    lineHeight: oSize.height + "px",
                    left: 0,
                    top: 0
                });
            }
            $("#restartDiv").text(iProcess + "%");
        } else {
            await WebVideoCtrl.I_StopUpgrade();
            clearInterval(g_tUpgrade);
            g_tUpgrade = 0;

            $("#restartDiv").remove();

            WebVideoCtrl.I_Restart(szDeviceIdentify, {
                success: function (xmlDoc) {
                    $("<div id='restartDiv' class='freeze'>reboot...</div>").appendTo("body");
                    var oSize = getWindowSize();
                    $("#restartDiv").css({
                        width: oSize.width + "px",
                        height: oSize.height + "px",
                        lineHeight: oSize.height + "px",
                        left: 0,
                        top: 0
                    });
                    setTimeout("reconnect('" + szDeviceIdentify + "')", 20000);
                },
                error: function (oError) {
                    showOPInfo(szDeviceIdentify + " reboot failed ", oError.errorCode, oError.errorMsg);
                }
            });
        }
    } else {
        await WebVideoCtrl.I_StopUpgrade();
        clearInterval(g_tUpgrade);
        g_tUpgrade = 0;

        $("#restartDiv").remove();

        WebVideoCtrl.I_Restart(szDeviceIdentify, {
            success: function () {
                $("<div id='restartDiv' class='freeze'>reboot...</div>").appendTo("body");
                var oSize = getWindowSize();
                $("#restartDiv").css({
                    width: oSize.width + "px",
                    height: oSize.height + "px",
                    lineHeight: oSize.height + "px",
                    left: 0,
                    top: 0
                });
                setTimeout("reconnect('" + szDeviceIdentify + "')", 20000);
            },
            error: function (oError) {
                showOPInfo(szDeviceIdentify + " reboot failed ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// check plugin version
function clickCheckPluginVersion() {
    var szDeviceIdentify = $("#ip").val();
    WebVideoCtrl.I_CheckPluginVersion().then((bNeedUpdate) => {
        if (bNeedUpdate) {
            alert("detect the latest plugin version.");
        } else {
            alert("your plugin version is the latest.");
        }
    }, () => {
        showOPInfo(szDeviceIdentify + " check plugin version failed.");
    });
}

function clickRestoreDefault() {
    var szDeviceIdentify = $("#ip").val(),
        szMode = "basic";
    WebVideoCtrl.I_RestoreDefault(szDeviceIdentify, szMode).then(() => {
        $("#restartDiv").remove();
        showOPInfo(szDeviceIdentify + " restore default successful.");
    }, (oError) => {
        showOPInfo(szDeviceIdentify + " restore default failed ", oError.errorCode, oError.errorMsg);
    });
}

function PTZZoomIn() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(10, false, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Zoom+success.");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + "  Zoom+success failed ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZZoomout() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(11, false, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Zoom-success.");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + "  Zoom-failed.", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZZoomStop() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(11, true, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " stop zoom success.");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + "  stop zoom failed ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZFocusIn() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(12, false, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " focus+success.");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + "  focus+failed ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZFoucusOut() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(13, false, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " focus-success.");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + "  focus-failed ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZFoucusStop() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(12, true, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " stop focus success.");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + "  stop focus failed ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZIrisIn() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(14, false, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Iris+success.");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + "  Iris+failed ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZIrisOut() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(15, false, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Iris-success.");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + "  Iris-failed ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZIrisStop() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(14, true, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " stop Iris success.");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + "  stop Iris failed ", oError.errorCode, oError.errorMsg);
            }
        });
    }
}


// polygon drawing enabled
var g_bEnableDraw = false;
function clickEnableDraw() {
    WebVideoCtrl.I_SetPlayModeType(6).then(() => {
        g_bEnableDraw = true;
        showOPInfo("drawing enabled succeed.");
    }, (oError) => {
        showOPInfo("drawing enabled failed ", oError.errorCode, oError.errorMsg);
    });
}

// polygon drawing disabled
function clickDisableDraw() {
    WebVideoCtrl.I_SetSnapDrawMode(0, -1).then(() => {
        g_bEnableDraw = false;
        showOPInfo("drawing disabled success.");
    }, (oError) => {
        showOPInfo("drawing disabled failed ", oError.errorCode, oError.errorMsg);
    });
}

// add the graph
function clickAddSnapPolygon() {
    if (!g_bEnableDraw) {
        return;
    }

    var szId = $("#snapId").val();
    var szName = encodeString($("#snapName").val());

    var szInfo = "<?xml version='1.0' encoding='utf-8'?>";
    szInfo += "<SnapPolygonList>";
    szInfo += "<SnapPolygon>";
    szInfo += "<id>" + szId + "</id>";          // [1, 32]
    szInfo += "<polygonType>0</polygonType>"; //if draw polygon, set polygonType 1
    szInfo += "<PointNumMax>17</PointNumMax>";  // [MinClosed, 17]
    szInfo += "<MinClosed>4</MinClosed>";       // [4, 17]
    szInfo += "<tips>#" + szId + "#" + szName + "</tips>";
    szInfo += "<isClosed>false</isClosed>";
    szInfo += "<color><r>0</r><g>255</g><b>0</b></color>";
    szInfo += "<pointList/>";
    szInfo += "</SnapPolygon>";
    szInfo += "</SnapPolygonList>";

    WebVideoCtrl.I_SetSnapPolygonInfo(g_iWndIndex, szInfo).then(() => {
        showOPInfo("add graph succeed.");
    });
    WebVideoCtrl.I_SetSnapDrawMode(g_iWndIndex, 2);
}

// delete the graph
function clickDelSnapPolygon() {
    if (!g_bEnableDraw) {
        return;
    }

    var szId = $("#snapId").val();
    var aShapes = [];
    aShapes.push({
        polygonType: 0,
        id: szId
    });

    WebVideoCtrl.I_ClearSnapInfo(g_iWndIndex, aShapes);
}

//get graph info
function clickGetSnapPolygon() {
    WebVideoCtrl.I_GetSnapPolygonInfo(g_iWndIndex).then((szXml) => {
        alert(szXml);
    });
}

//set graph ifno
function clickSetSnapPolygon() {
    if (!g_bEnableDraw) {
        return;
    }

    WebVideoCtrl.I_ClearSnapInfo(g_iWndIndex);

    var szInfo = "<?xml version='1.0' encoding='utf-8'?>";
    szInfo += "<SnapPolygonList>";
    szInfo += "<SnapPolygon>";
    szInfo += "<id>1</id>";
    szInfo += "<polygonType>1</polygonType>";
    szInfo += "<tips>#1#</tips>";
    szInfo += "<isClosed>true</isClosed>";
    szInfo += "<color><r>0</r><g>255</g><b>0</b></color>";
    szInfo += "<pointList>";
    szInfo += "<point><x>0.737903</x><y>0.229730</y></point>";
    szInfo += "<point><x>0.947581</x><y>0.804054</y></point>";
    szInfo += "<point><x>0.362903</x><y>0.777027</y></point>";
    szInfo += "</pointList>";
    szInfo += "</SnapPolygon>";
    szInfo += "<SnapPolygon>";
    szInfo += "<id>2</id>";
    szInfo += "<polygonType>0</polygonType>";
    szInfo += "<tips>#2#</tips>";
    szInfo += "<isClosed>true</isClosed>";
    szInfo += "<color><r>255</r><g>255</g><b>0</b></color>";
    szInfo += "<pointList>";
    szInfo += "<point><x>0.2</x><y>0.2</y></point>";
    szInfo += "<point><x>0.8</x><y>0.2</y></point>";
    szInfo += "<point><x>0.8</x><y>0.8</y></point>";
    szInfo += "<point><x>0.2</x><y>0.8</y></point>";
    szInfo += "</pointList>";
    szInfo += "</SnapPolygon>";
    szInfo += "</SnapPolygonList>";

    WebVideoCtrl.I_SetSnapPolygonInfo(g_iWndIndex, szInfo).then(() => {
        showOPInfo("set the graph succeed.");
    }, (oError) => {
        showOPInfo("set the graph failed ", oError.errorCode, oError.errorMsg);
    });
}

// clear the graph
function clickDelAllSnapPolygon() {
    if (!g_bEnableDraw) {
        return;
    }

    WebVideoCtrl.I_ClearSnapInfo(g_iWndIndex).then(() => {
        showOPInfo("clear the graph successful.");
    }, (oError) => {
        showOPInfo("clear the graph failed ", oError.errorCode, oError.errorMsg);
    });
}


function loadXML(szXml) {
    if(null == szXml || "" == szXml) {
        return null;
    }

    var oXmlDoc = null;

    if (window.DOMParser) {
        var oParser = new DOMParser();
        oXmlDoc = oParser.parseFromString(szXml, "text/xml");
    } else {
        oXmlDoc = new ActiveXObject("Microsoft.XMLDOM");
        oXmlDoc.async = false;
        oXmlDoc.loadXML(szXml);
    }

    return oXmlDoc;
}

function toXMLStr(oXmlDoc) {
    var szXmlDoc = "";

    try {
        var oSerializer = new XMLSerializer();
        szXmlDoc = oSerializer.serializeToString(oXmlDoc);
    } catch (e) {
        try {
            szXmlDoc = oXmlDoc.xml;
        } catch (e) {
            return "";
        }
    }
    if (szXmlDoc.indexOf("<?xml") == -1) {
        szXmlDoc = "<?xml version='1.0' encoding='utf-8'?>" + szXmlDoc;
    }

    return szXmlDoc;
}

function encodeString(str) {
    if (str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    } else {
        return "";
    }
}