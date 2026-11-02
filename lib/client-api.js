export async function workspaceFetch(input,options){
  const response=await fetch(input,options);
  if(response.status===401&&typeof window!=='undefined')window.dispatchEvent(new Event('finn:locked'));
  return response;
}
