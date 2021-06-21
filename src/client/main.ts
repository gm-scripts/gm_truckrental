import ts from "typescript";
import { script, plate } from "../config";
let callbacks: unknown;
callbacks = 0;
callbacks = {};
const RegisterNetEvent = (data: string) => {
  ts.transpile(`RegisterNetEvent(${data})`);
};
RegisterNetEvent(`gm_${script}:callback`);
onNet(`gm_${script}:callback`, (result: unknown, id: number) => {
  callbacks[id](result);
  delete callbacks[id];
});
const serverCallback = (name: string, data: unknown, cb: unknown): void => {
  let id: number;
  id = 0;
  id = Object.keys(callbacks).length++;
  callbacks[id] = cb;
  data["CallbackID"] = id;
  emitNet(name, data);
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////

import { conf, lang, notifyText, helpText, error } from "./utils";

let isConfigSynced = false;
let rentedVehicle = null;
let stopRent = false;
let haveVehicle = false;
let rental: number;
const products = [];

RegisterNuiCallbackType("config");
RegisterNuiCallbackType("products");
RegisterNuiCallbackType("close");
RegisterNuiCallbackType("buy");

on("__cfx_nui:config", (data, cb) => {
  const interval = setTick(() => {
    if (isConfigSynced) {
      cb({
        scale: conf["menu"].scale,
        bgPrimary: conf["menu"].bgPrimary,
        bgSecondary: conf["menu"].bgSecondary,
        tlActive: conf["menu"].xActive,
        tlInactive: conf["menu"].xInactive,
        langShopname: lang["shop_name"].replace("_vehicle_", lang["vehicle"]),
        langMoreInfo: lang["more_info"].replace("_vehicle_", lang["vehicle"]),
        langBuy: lang["buy"].replace("_vehicle_", lang["vehicle"]),
        langBack: lang["back"].replace("_vehicle_", lang["vehicle"]),
      });
      clearTick(interval);
    }
  });
});

on("__cfx_nui:products", (data, cb) => {
  const interval = setTick(() => {
    if (isConfigSynced) {
      cb(products);
      clearTick(interval);
    }
  });
});

const generatePlate = (data): string => {
  return `RENT-${plate}${data < 10 ? data : 0}${Math.floor(Math.random() * 9) + 1}`;
};
const spawnVehicle = data => {
  const vehicleHash = GetHashKey(conf["vehicles"][data].model);
  RequestModel(vehicleHash);
  const interval = setTick(() => {
    if (HasModelLoaded(vehicleHash)) {
      const player = PlayerPedId();
      const vehicle = CreateVehicle(
        vehicleHash,
        conf["zones"][rental]["spawn"]["x"],
        conf["zones"][rental]["spawn"]["y"],
        conf["zones"][rental]["spawn"]["z"],
        conf["zones"][rental]["spawn"]["h"],
        true,
        true,
      );
      TaskWarpPedIntoVehicle(player, vehicle, -1);
      SetVehicleFuelLevel(vehicle, 100.0);
      DecorSetFloat(vehicle, "_FUEL_LEVEL", GetVehicleFuelLevel(vehicle));
      SetVehicleNumberPlateText(vehicle, generatePlate(data + 1));
      notifyText(
        conf["rentForFree"]
          ? lang["vehicle_spawned_free"]
              .replace("_label_", conf["vehicles"][data].label)
              .replace("_vehicle_", lang["vehicle"])
          : lang["vehicle_spawned"]
              .replace("_vehicle_", lang["vehicle"])
              .replace("_label_", conf["vehicles"][data].label)
              .replace("_price_", conf["vehicles"][data].price.toString(), "success"),
      );
      rentedVehicle = vehicle;
      clearTick(interval);
    }
  });
};

on("__cfx_nui:buy", data => {
  if (!conf["rentForFree"]) {
    if (conf["framework"] === "esx" || conf["framework"] == "vrp") {
      if (haveVehicle) {
        notifyText(lang["already_rented"].replace("_vehicle_", lang["vehicle"]));
      } else {
        if (conf["payForTime"]) {
          serverCallback(
            `gm_${script}:tryPayment_${conf["framework"]}`,
            { payment: conf["vehicles"][data].price },
            succesfull => {
              if (succesfull) {
                spawnVehicle(data);
                SendNuiMessage(
                  JSON.stringify({
                    type: "gm_window_close",
                  }),
                );
                haveVehicle = true;
                const payRent = setInterval(() => {
                  if (GetVehicleEngineHealth(rentedVehicle) > 0) {
                    if (!stopRent) {
                      serverCallback(
                        `gm_${script}:tryPayment_${conf["framework"]}`,
                        { payment: conf["vehicles"][data].price },
                        succesfull => {
                          if (succesfull) {
                            notifyText(
                              lang["paid_rent"]
                                .replace("_label_", conf["vehicles"][data].label)
                                .replace(
                                  "_price_",
                                  conf["vehicles"][data].price.toString(),
                                  "success",
                                )
                                .replace("_vehicle_", lang["vehicle"]),
                            );
                          } else {
                            if (conf["blockIfCantPay"]) {
                              notifyText(
                                lang["cant_pay_rent"].replace("_vehicle_", lang["vehicle"]),
                              );
                              SetVehicleMaxSpeed(rentedVehicle, 0.0000000000000000001);
                              SetVehicleEngineOn(rentedVehicle, false, true, true);
                              haveVehicle = false;
                              clearInterval(payRent);
                            }
                          }
                        },
                      );
                    } else {
                      stopRent = false;
                      clearInterval(payRent);
                    }
                  } else {
                    if (conf["payIfDestroyed"]) {
                      serverCallback(
                        `gm_${script}:forcePayment_${conf["framework"]}`,
                        {
                          payment: conf["vehicles"][data].price * conf["destroyedPayMultiplier"],
                        },
                        cb => {
                          notifyText(
                            lang["vehicle_destroyed"]
                              .replace("_price_", cb.toString())
                              .replace("_vehicle_", lang["vehicle"]),
                          );
                        },
                      );
                      haveVehicle = false;
                      clearInterval(payRent);
                    }
                  }
                }, conf["payInterval"] * 60000);
              } else {
                notifyText(lang["not_enough_cash"].replace("_vehicle_", lang["vehicle"]));
              }
            },
          );
        } else {
          serverCallback(
            `gm_${script}:tryPayment_${conf["framework"]}`,
            { payment: conf["vehicles"][data].price },
            succesfull => {
              if (succesfull) {
                spawnVehicle(data);
                SendNuiMessage(
                  JSON.stringify({
                    type: "gm_window_close",
                  }),
                );
                haveVehicle = true;
              } else {
                notifyText(lang["not_enough_cash"].replace("_vehicle_", lang["vehicle"]));
              }
            },
          );
        }
      }
    } else if (conf["framework"] === "none") {
      conf["rentForFree"] = true;
      spawnVehicle(data);
    } else {
      error(`Unknown framework. Please use "esx", "vrp" or "none"`, "config");
    }
  } else {
    spawnVehicle(data);
  }
});

on("__cfx_nui:close", () => {
  SetNuiFocus(false, false);
});

const configLoaded = (): void => {
  if (conf["framework"] === "none") {
    conf["rentForFree"] = true;
  }
  for (let i = 0; i < conf["vehicles"].length; i++) {
    products.push({
      id: i,
      name: conf["vehicles"][i].label,
      price: conf["rentForFree"]
        ? lang["free"].replace("_vehicle_", lang["vehicle"])
        : conf["payForTime"]
        ? lang["pay_for_time"]
            .replace("_price_", conf["vehicles"][i].price.toString())
            .replace("_vehicle_", lang["vehicle"])
            .replace("_minutes_", conf["payInterval"].toString())
        : lang["pay_once"]
            .replace("_price_", conf["vehicles"][i].price.toString())
            .replace("_vehicle_", lang["vehicle"]),

      image: "img/" + conf["vehicles"][i].model + ".png",
      additionalInfo: conf["vehicles"][i].info,
    });
  }
  isConfigSynced = true;
  const marker = conf["marker"];
  const zones = conf["zones"];
  const keys = conf["keys"];
  const blip = conf["blips"];
  let blips: unknown;
  blips = 0;
  blips = [];
  for (let i = 0; i < zones.length; i++) {
    if (zones[i].showBlip) {
      blips[i] = AddBlipForCoord(zones[i].marker.x, zones[i].marker.y, zones[i].marker.z);
      SetBlipSprite(blips[i], blip.id);
      SetBlipDisplay(blips[i], 4);
      SetBlipScale(blips[i], blip.size);
      SetBlipColour(blips[i], blip.color);
      SetBlipAsShortRange(blips[i], true);
      BeginTextCommandSetBlipName("STRING");
      AddTextComponentString(lang["blip_title"].replace("_vehicle_", lang["vehicle"]));
      EndTextCommandSetBlipName(blips[i]);
    }
  }
  setTick(() => {
    const coords = GetEntityCoords(PlayerPedId(), true);
    for (let i = 0; i < zones.length; i++) {
      if (
        marker.type != -1 &&
        GetDistanceBetweenCoords(
          coords[0],
          coords[1],
          coords[2],
          zones[i].marker.x,
          zones[i].marker.y,
          zones[i].marker.z,
          true,
        ) < marker.distance.show
      ) {
        DrawMarker(
          marker.type,
          zones[i].marker.x,
          zones[i].marker.y,
          zones[i].marker.z,
          marker.direction.x,
          marker.direction.y,
          marker.direction.z,
          marker.rotation.x,
          marker.rotation.y,
          marker.rotation.z,
          marker.scale.x,
          marker.scale.y,
          marker.scale.z,
          marker.color.r,
          marker.color.g,
          marker.color.b,
          marker.alpha,
          marker.bob,
          marker.face,
          2,
          false,
          null,
          null,
          false,
        );
        if (
          GetDistanceBetweenCoords(
            coords[0],
            coords[1],
            coords[2],
            zones[i].marker.x,
            zones[i].marker.y,
            zones[i].marker.z,
            true,
          ) < marker.distance.open
        ) {
          if (!IsPedInAnyVehicle(PlayerPedId(), false)) {
            helpText(lang["press_e"].replace("_vehicle_", lang["vehicle"]));
            if (IsControlJustPressed(0, keys.openMenu)) {
              if (haveVehicle) {
                notifyText(lang["already_rented"].replace("_vehicle_", lang["vehicle"]));
              } else {
                rental = i;
                SendNuiMessage(
                  JSON.stringify({
                    type: "gm_window_open",
                  }),
                );
                SetNuiFocus(true, true);
              }
            }
          }
        }
      }
    }
    if (haveVehicle) {
      for (let i = 0; i < zones.length; i++) {
        if (
          marker.type != -1 &&
          GetDistanceBetweenCoords(
            coords[0],
            coords[1],
            coords[2],
            zones[i].spawn.x,
            zones[i].spawn.y,
            zones[i].spawn.z,
            true,
          ) < marker.distance.show
        ) {
          DrawMarker(
            marker.type,
            zones[i].spawn.x,
            zones[i].spawn.y,
            zones[i].spawn.z,
            marker.direction.x,
            marker.direction.y,
            marker.direction.z,
            marker.rotation.x,
            marker.rotation.y,
            marker.rotation.z,
            5.0,
            5.0,
            1.0,
            marker.color.r,
            marker.color.g,
            marker.color.b,
            marker.alpha,
            marker.bob,
            marker.face,
            2,
            false,
            null,
            null,
            false,
          );
          if (
            GetDistanceBetweenCoords(
              coords[0],
              coords[1],
              coords[2],
              zones[i].spawn.x,
              zones[i].spawn.y,
              zones[i].spawn.z,
              true,
            ) < 5.0
          ) {
            if (
              IsPedInAnyVehicle(PlayerPedId(), false) &&
              GetVehiclePedIsIn(PlayerPedId(), false) == rentedVehicle
            ) {
              helpText(lang["store_vehicle"].replace("_vehicle_", lang["vehicle"]));
              if (IsControlJustPressed(0, keys.openMenu)) {
                if (conf["payForDamage"]) {
                  const toPay = Math.floor(
                    (1000 -
                      GetVehicleBodyHealth(rentedVehicle) +
                      (1000 - GetVehicleEngineHealth(rentedVehicle))) *
                      conf["damageCost"],
                  );
                  if (conf["framework"] === "esx" || conf["framework"] === "vrp") {
                    serverCallback(
                      `gm_${script}:forcePayment_${conf["framework"]}`,
                      { payment: toPay },
                      cb => {
                        notifyText(
                          lang["pay_for_damage"]
                            .replace("_price_", cb)
                            .replace("_vehicle_", lang["vehicle"]),
                        );
                      },
                    );
                  }
                }
                SetEntityAsMissionEntity(rentedVehicle, true, true);
                DeleteVehicle(rentedVehicle);
                stopRent = true;
                haveVehicle = false;
                notifyText(lang["stored_vehicle"].replace("_vehicle_", lang["vehicle"]));
                SetPedCoordsKeepVehicle(PlayerPedId(), zones[i].marker.x, zones[i].marker.y, zones[i].marker.z)
              }
            }
          }
        }
      }
    }
  });
};

export { configLoaded };
