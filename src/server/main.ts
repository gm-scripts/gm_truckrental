import { script } from "../config";

onNet(`gm_${script}:tryPayment_esx`, data => {
  let ESX: unknown;
  emit("esx:getSharedObject", obj => (ESX = obj));
  const xPlayer = ESX["GetPlayerFromId"](source);
  let cb = false;
  if (xPlayer.getMoney() >= data.payment) {
    xPlayer.removeMoney(data.payment);
    cb = true;
  }
  emitNet(`gm_${script}:callback`, source, cb, data.CallbackID);
});

onNet(`gm_${script}:forcePayment_esx`, data => {
    let ESX: unknown;
    emit("esx:getSharedObject", obj => (ESX = obj));
    const xPlayer = ESX["GetPlayerFromId"](source);
    let cb = 0;
    if (xPlayer.getMoney() >= data.payment) {
      xPlayer.removeMoney(data.payment);
      cb = data.payment;
    } else {
      cb = xPlayer.getMoney()
      xPlayer.removeMoney(xPlayer.getMoney())
    }
    emitNet(`gm_${script}:callback`, source, cb, data.CallbackID);
  });
  
