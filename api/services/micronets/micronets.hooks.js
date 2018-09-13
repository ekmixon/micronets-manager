const { authenticate } = require ( '@feathersjs/authentication' ).hooks;
const subnetAllocation = require ( '../../hooks/subnetAllocaiton' )
const micronetWithDevices = require ( '../../mock-data/micronetWithDevices' );
const micronetWithoutDevices = require ( '../../mock-data/micronetWithoutDevices' );
const micronetOperationalConfig = require ( '../../mock-data/micronetsOperationalConfig' );

var rn = require ( 'random-number' );
var async = require ( "async" );
const axios = require ( 'axios' );
const apiInit = { crossDomain : true , headers : { 'Content-type' : 'application/json' } }
var options = { integer : true }
const omit = require ( 'ramda/src/omit' );
const omitMeta = omit ( [ 'updatedAt' , 'createdAt' , '_id' , '__v' ] );

/* BootStrap Sequence */
const isGatewayAlive = async ( hook ) => {
  console.log ( '\n isGatewayAlive hook ...' )
  return true
}

const connectToGateway = async ( hook ) => {
  console.log ( '\n connectToGateway hook ...' )
  return true
}

const isODLAlive = async ( hook ) => {
  // Poll ODL mn notifications for OVS Manager connection
  console.log ( '\n isODLAlive hook' )
  const odlNotifications = await axios ( {
    ...apiInit ,
    method : 'get' ,
    url : `http://127.0.0.1:3030/mm/v1/mock/restconf/config/micronets-notifications:micronets-notifications` ,
  } )
  console.log ( '\n isODLAlive ODL Notifications : ' + JSON.stringify ( odlNotifications.data ) )
  return true
}
/* BootStrap Sequence */

const fetchOdlOperationalState = async ( hook ) => {
  console.log ( '\n fetchOdlOperationalState hook' )
  /* Axios Call
  // URL : http://{{odlhost}}:{{odlsocket}}/restconf/operational/micronets:micronets
  const odlOperationalState = await axios ( {
    ...apiInit ,
    method : 'get' ,
    url : `http://{{odlhost}}:{{odlsocket}}/restconf/operational/micronets:micronets` ,
  } )
  */
  const odlOperationalState = Object.assign ( {} , micronetOperationalConfig )
  console.log ( '\n fetchOdlOperationalState : ' + JSON.stringify ( odlOperationalState ) )
  return odlOperationalState
}

const getOdlConfig = async ( hook , id ) => {
  console.log ( '\n getOdlConfig hook with passed id : ' + JSON.stringify ( id ) )
  return hook.app.service ( 'odl/v1/micronets/config' ).get ( id )
    .then ( ( data ) => {
      console.log ( '\n Data from odl config : ' + JSON.stringify ( data ) )
      return data
    } )
}

const isOdlStaticConfigPresent = async ( hook , reqBody ) => {
  console.log ( '\n isOdlStaticConfigPresent Hook with Request Body : ' + JSON.stringify ( reqBody ) )
  const { micronet } = reqBody.micronets
  const noOfMicronets = micronet.length
  micronet.forEach ( ( micronet , index ) => {
    if ( hasProp ( micronet , 'trunk-gateway-port' ) && hasProp ( micronet , 'trunk-gateway-ip' ) && hasProp ( micronet , 'dhcp-server-port' ) && hasProp ( micronet , 'ovs-bridge-name' ) && hasProp ( micronet , 'ovs-manager-ip' ) ) {
      console.log ( '\n Properties found for ODL STATIC CONFIG  ' )
      return true
    }
  } )
  return false
}

const populateOdlConfig = async ( hook , requestBody , gatewayId ) => {
  console.log ( '\n populateOdlConfig requestBody : ' + JSON.stringify ( requestBody ) )
  console.log ( '\n populateOdlConfig gatewayId : ' + JSON.stringify ( gatewayId ) )
  const { micronet } = requestBody.micronets;
  const odlStaticConfig = await getOdlConfig ( hook , gatewayId )
  const { switchConfig } = odlStaticConfig
  console.log ( '\n  ODL STATIC CONFIG FROM API  : ' + JSON.stringify ( switchConfig ) )
  const reqBodyWithOdlConfig = micronet.map ( ( micronet , index ) => {
    return {
      ...micronet ,
      "trunk-gateway-port" : switchConfig.bridges[ index ].portTrunk ,
      "trunk-gateway-ip" : switchConfig.bridges[ index ].ovsHost ,
      "dhcp-server-port" : switchConfig.bridges[ index ].portBridge ,
      "ovs-bridge-name" : switchConfig.bridges[ index ].bridge ,
      "ovs-manager-ip" : switchConfig.bridges[ index ].ovsHost
    }
  } )
  return reqBodyWithOdlConfig
}

const getSubnet = ( hook , index ) => {
  subnetAllocation.getNewSubnet ( index ).then ( ( subnet ) => {
    console.log ( '\n GET SUBNET FUNCTION SUBNET OBTAINED : ' + JSON.stringify ( subnet ) )
    return subnet
  } )
}

const getSubnetIps = async ( hook , subnetDetails , requestBody ) => {
  console.log ( '\n GET SUBNET IPs  requestBody : ' + JSON.stringify ( requestBody ) )
  console.log ( '\n GET SUBNET IPs  subnetDetails : ' + JSON.stringify ( subnetDetails ) )
  const promises = await Promise.all ( subnetDetails.map ( async ( subnet , index ) => {
    console.log ( '\n Calling IPAllocator for subnet : ' + JSON.stringify ( subnet ) + '\t\t At Index : ' + JSON.stringify ( index ) )
    const subnets = await subnetAllocation.getNewSubnet ( index )
    console.log ( '\n GET SUBNET IPs Subnet Obtained from IPAllocator : ' + JSON.stringify ( subnets ) )
    return Object.assign ( {} , subnets )
  } ) )
  console.log ( '\n GET SUBNET IPs Obtained promises : ' + JSON.stringify ( promises ) )
  return promises
}

const getDeviceForSubnet = async ( hook , subnetDetails , subnets ) => {
  subnetDetails = [].concat ( ...subnetDetails );
  console.log ( '\n GET DEVICE FOR SUBNET Passed subnetDetails : ' + JSON.stringify ( subnetDetails ) )
  console.log ( '\n GET DEVICE FOR SUBNET Passed subnets : ' + JSON.stringify ( subnets ) )
  let devicesWithIp = await Promise.all ( subnets.map ( async ( subnet , subnetIndex ) => {
    console.log ( '\n Current Subnet : ' + JSON.stringify ( subnet ) + '\t\t Subnet Index : ' + JSON.stringify ( subnetIndex ) )
    // console.log ( '\n Current Subnet Details : ' + JSON.stringify ( subnetDetails[ subnetIndex ] ) + '\t\t subnetDetails[ subnetIndex ].devices.length : ' + JSON.stringify(subnetDetails[ subnetIndex ].devices.length) )
    console.log ( '\n subnetIndex < subnetDetails.length : ' + JSON.stringify ( subnetIndex < subnetDetails.length ) )
    if ( subnetIndex < subnetDetails.length && subnetDetails[ subnetIndex ].devices.length >= 1 ) {
      const devices = subnetDetails[ subnetIndex ].devices
      console.log ( '\n All Devices array from Subnet Details : ' + JSON.stringify ( devices ) )
      const subnetAndDeviceIpData = await subnetAllocation.getNewIps ( subnet.subnet , devices )
      console.log ( '\n GET DEVICE FOR SUBNET subnetAndDeviceIpData : ' + JSON.stringify ( subnetAndDeviceIpData ) )
      return {
        ...subnetAndDeviceIpData
      }
    }
  } ) )

  devicesWithIp = [].concat ( ...devicesWithIp )
  console.log ( '\n GET DEVICE FOR SUBNET devicesWithIp : ' + JSON.stringify ( devicesWithIp ) )
  return devicesWithIp
}

const getSubnetAndDeviceIps = async ( hook , requestBody ) => {
  console.log ( '\n GET SUBNET AND DEVICE IPs requestBody : ' + JSON.stringify ( requestBody ) )
  const noOfSubnets = requestBody.length
  console.log ( '\n No of Subnets : ' + JSON.stringify ( noOfSubnets ) )
  const subnetDetails = requestBody.map ( ( micronet , index ) => {
    return Object.assign ( {} , {
      name : micronet.name ,
      devices : micronet[ 'connected-devices' ]
    } )
  } )
  console.log ( '\n GET SUBNET AND DEVICE IPs Subnet Details : ' + JSON.stringify ( subnetDetails ) )
  const subnets = await getSubnetIps ( hook , subnetDetails , requestBody )
  console.log ( '\n GET SUBNET AND DEVICE IPs Obtained subnets : ' + JSON.stringify ( subnets ) )

  /* Add check for devices length in subnetDetails array */
  let subnetDetailsWithDevices = subnetDetails.map ( ( subnetDetail , index ) => {
    // console.log('\n subnetDetail.devices.length : ' + JSON.stringify(subnetDetail.devices.length))
    if ( subnetDetail.devices.length >= 1 ) {
      return subnetDetail
    }
  } )

  subnetDetailsWithDevices = subnetDetailsWithDevices.filter ( Boolean )
  console.log ( '\n Subnet Details with devices : ' + JSON.stringify ( subnetDetailsWithDevices ) )
  console.log ( '\n subnetDetailsWithDevices.length : ' + JSON.stringify ( subnetDetailsWithDevices.length ) )
  console.log ( '\n subnets.length : ' + JSON.stringify ( subnets.length ) )

  /* All Subnets have Devices */
  if ( subnets.length == subnetDetailsWithDevices.length ) {
    console.log ( '\n All subnets have devices .... ' )
    const subnetsWithDevices = await getDeviceForSubnet ( hook , subnetDetails , subnets )
    console.log ( '\n ALL SUBNET WITH DEVICES RESULT : ' + JSON.stringify ( subnetsWithDevices ) )
    return subnetsWithDevices
  }

  /* Few Subnets have Devices */
  if ( subnets.length > 0 && subnetDetailsWithDevices.length >= 1 && subnets.length > subnetDetailsWithDevices.length ) {
    console.log ( '\n Not all subnets have devices ...' )
    const subnetsWithDevicesSubset = subnetDetailsWithDevices.map ( ( sbd , index ) => {
      return subnets[ index ]
    } )
    console.log ( '\n subnetsWithDevicesSubset : ' + JSON.stringify ( subnetsWithDevicesSubset ) )
    const subnetsWithDevices = await getDeviceForSubnet ( hook , subnetDetailsWithDevices , subnetsWithDevicesSubset )
    console.log ( '\n subnetsWithDevices : ' + JSON.stringify ( subnetsWithDevices ) )

    const subnetsWithoutDevices = subnets.map ( ( subnet , index ) => {
      console.log ( '\n subnet : ' + JSON.stringify ( subnet ) + '\t\t Index : ' + JSON.stringify ( index ) + '\t\t subnetsWithDevices.length : ' + JSON.stringify ( subnetsWithDevices ) )

      if ( index < subnetsWithDevices.length && subnet.subnet != subnetsWithDevices[ index ].subnet ) {
        console.log ( '\n Subnet without device : ' + JSON.stringify ( subnet ) )
        return subnet
      }
      if ( index >= subnetsWithDevices.length ) {
        console.log ( '\n Subnet : ' + JSON.stringify ( subnet ) )
        return subnet
      }
    } )

    console.log ( '\n subnetsWithoutDevices : ' + JSON.stringify ( subnetsWithoutDevices ) )
    let allSubnets = subnetsWithoutDevices.concat ( subnetsWithDevices )
    allSubnets = allSubnets.filter ( Boolean )
    console.log ( '\n SUBNET WITH AND WITHOUT DEVICES : ' + JSON.stringify ( allSubnets ) )
    return allSubnets

  }

  /* No subnets have devices */
  if ( subnets.length > 0 && subnetDetailsWithDevices.length == 0 ) {
    return subnets
  }

}

function hasProp ( obj , prop ) {
  console.log ( '\n hasProp called for prop ' + JSON.stringify ( prop ) + '\t VALUE : ' + JSON.stringify ( Object.prototype.hasOwnProperty.call ( obj , prop ) ) )
  return Object.prototype.hasOwnProperty.call ( obj , prop );
}

const populatePostObj = async ( hook , reqBody ) => {
  console.log ( '\n POPULATE POST OBJ Request Body : ' + JSON.stringify ( reqBody ) )
  const { micronet } = reqBody.micronets
  const noOfMicronets = micronet.length
  console.log ( '\n POPULATE POST OBJ noOfMicro-nets : ' + JSON.stringify ( noOfMicronets ) )

  /* Populate ODL Static Config */
  const reqBodyWithOdlConfig = await populateOdlConfig ( hook , reqBody , '1234' )
  console.log ( '\n\n POPULATE POST OBJ reqBodyWithOdlConfig : ' + JSON.stringify ( reqBodyWithOdlConfig ) )

  /* Populate Sub-nets and Devices Config */
  const subnetAndDeviceIps = await getSubnetAndDeviceIps ( hook , reqBodyWithOdlConfig )
  console.log ( '\n POPULATE POST OBJ SUBNET AND DEVICE IPs  : ' + JSON.stringify ( subnetAndDeviceIps ) )
  console.log ( '\n POPULATE POST OBJ REQUEST BODY WITH ODL CONFIG : ' + JSON.stringify ( reqBodyWithOdlConfig ) )
  let updatedReqPostBody = reqBodyWithOdlConfig.map ( ( reqPostBody , index ) => {
    console.log ( '\n\n reqPostBody : ' + JSON.stringify ( reqPostBody ) )
    console.log ( '\n\n subnetAndDeviceIps : ' + JSON.stringify ( subnetAndDeviceIps[ index ] ) )
    return {
      ...reqPostBody ,
      "micronet-subnet" : subnetAndDeviceIps[ index ].micronetSubnet ,
      "micronet-gateway-ip" : subnetAndDeviceIps[ index ].micronetGatewayIp ,
      "dhcp-zone" : subnetAndDeviceIps[ index ].micronetSubnet ,
      "connected-devices" : subnetAndDeviceIps[ index ].connectedDevices
    }
  } )
  updatedReqPostBody = [].concat ( ...updatedReqPostBody )
  console.log ( '\n  POPULATE POST OBJ  : ' + JSON.stringify ( updatedReqPostBody ) )
  return updatedReqPostBody
}

const sanityCheckForMM = async hook => {
  console.log ( '\n sanityCheckForMM hook' )
  return true
}

const populateMMWithOdlResponse = async hook => {
  console.log ( '\n populateMMWithOdlResponse hook' )
  return true
}

const initializeMicronets = async ( hook , postBody ) => {
  console.log ( '\n Initialize Micro-nets function postBody: ' + JSON.stringify ( postBody ) )
  hook.data = Object.assign ( {} , { micronets : micronetWithoutDevices.micronets } )
  return hook
}

const getMicronet = async ( hook , query ) => {
  // console.log('\n GET MICRONET : ' + JSON.stringify(query))
  const micronetFromDb = await hook.app.service ( '/mm/v1/micronets' ).find ( query )
  // console.log('\n MICRONET FROM DB : ' + JSON.stringify(micronetFromDb.data[0]))
  return micronetFromDb.data[ 0 ]
}

/* ODL Config PUT Call */

const upsertOdLConfigState = async ( hook , postBody ) => {

  console.log ( '\n upsertOdLConfigState hook postBody : ' + JSON.stringify ( postBody ) )

  /* AXIOS ODL call.Check for Response Code 201 or 200
  const odlConfigResponse = await axios ( {
    ...apiInit ,
    method : 'put' ,
    url : `http://{{odlhost}}:{{odlsocket}}/restconf/config/micronets:micronets` ,
    data: postBody
  })
  */

  const odlConfigResponse = Object.assign ( { response : { statusCode : 201 } } )
  console.log ( '\n upsertOdLConfigState odLConfigResponse : ' + JSON.stringify ( odlConfigResponse ) )
  return odlConfigResponse
}

const subnetPresentCheck = async ( hook , body , micronetFromDb ) => {
  let subnetsStatus = Object.assign ( {} , {
    found : [] ,
    notFound : []
  } )

  //console.log('\n SUBNET PRESENT CHECK BODY : ' + JSON.stringify(body) + '\t\t FOUND MICRO-NET : ' + JSON.stringify(micronetFromDb))
  const foundMicronet = micronetFromDb.micronets.micronet
  //console.log('\n SUBNETS FROM DB : ' + JSON.stringify(foundMicronet))
  const subnetsFromPost = body.micronets.micronet
  //console.log('\n SUBNETS FROM BODY : ' + JSON.stringify(subnetsFromPost))
  const existingMicronetClass = foundMicronet.map ( ( micronet , index ) => {
    return micronet.class
  } )
  //console.log('\n Existing Micronet Class : ' + JSON.stringify(existingMicronetClass))
  subnetsFromPost.forEach ( ( subnetFromPost , index ) => {
    const foundIndex = existingMicronetClass.indexOf ( subnetFromPost.name )
    console.log ( '\n FoundIndex : ' + JSON.stringify ( foundIndex ) + '\t\t Subnet Name : ' + JSON.stringify ( subnetFromPost.name ) )
    if ( foundIndex == -1 ) {
      subnetsStatus.notFound = [ subnetFromPost.name ]
    }
    if ( foundIndex > -1 ) {
      subnetsStatus.found = [ subnetFromPost.name ]
    }
  } )

  // console.log('\n SUBNET PRESENT CHECK Subnet Status : ' + JSON.stringify(subnetsStatus))
  return subnetsStatus
}

const createSubnetInMicronet = async ( hook , postBody , subnetsToAdd ) => {
  console.log ( '\n CREATE SUBNET IN MICRO-NET postBody : ' + JSON.stringify ( postBody ) + '\t\t Subnets To Add : ' + JSON.stringify ( subnetsToAdd ) )
  const finalPostBody = await populatePostObj ( hook , postBody )
  console.log ( '\n finalPostBody : ' + JSON.stringify ( finalPostBody ) )
  return finalPostBody
}

const upsertSubnetsToMicronet = async ( hook , body ) => {
  let postBodyForODL = []
  console.log ( '\n UPSERT SUBNETS TO MICRO-NET BODY: ' + JSON.stringify ( body ) )
  const micronetFromDb = await getMicronet ( hook , query = {} )
  console.log ( '\n MICRONET FROM DB : ' + JSON.stringify ( micronetFromDb ) )
  // TODO : Add Logic to check with operational state
  const subnetsStatus = await subnetPresentCheck ( hook , body , micronetFromDb )
  console.log ( '\n UPSERT SUBNETS TO MICRO-NET subnetsStatus : ' + JSON.stringify ( subnetsStatus ) )
  console.log ( '\n SUBNETS STATUS NOT FOUND ARRAY LENGTH : ' + JSON.stringify ( subnetsStatus.notFound.length ) )
  if ( subnetsStatus.notFound.length >= 1 ) {
    console.log ( '\n Create subnets for ' + JSON.stringify ( subnetsStatus.notFound ) )
    const subnetsToAdd = await createSubnetInMicronet ( hook , body , subnetsStatus.notFound )
    console.log ( '\n UPSERT SUBNETS TO MICRO-NET subnetsToAdd : ' + JSON.stringify ( subnetsToAdd ) )
    postBodyForODL = micronetFromDb.micronets.micronet.concat ( subnetsToAdd )
    console.log ( '\n postBodyForODL with added subnets : ' + JSON.stringify ( postBodyForODL ) )

  }
  if ( subnetsStatus.notFound.length == 0 ) {
    console.log ( '\n Subnet already present . Do nothing ' )
    postBodyForODL = Object.assign ( {} , { micronets : { micronet : micronetFromDb.micronets.micronet } } )
    console.log ( '\n postBodyForODL from DB : ' + JSON.stringify ( postBodyForODL ) )
  }

  // hook.data = Object.assign ( {} , { micronets : micronetWithoutDevices.micronets } )
  // console.log ( '\n ADD SUBNET TO MICRONET function hook.data : ' + JSON.stringify ( hook.data ) )
  return postBodyForODL
}

const addDevicesToMicronet = async ( hook , postBody ) => {
  console.log ( '\n ADD DEVICES TO MICRONET function postBody: ' + JSON.stringify ( postBody ) )
  hook.data = Object.assign ( {} , { micronets : micronetWithDevices.micronets } )
  console.log ( '\n ADD DEVICES TO MICRONET function hook.data : ' + JSON.stringify ( hook.data ) )
  return hook
}

const updateMicronetModel = async ( hook , response ) => {
  console.log ( '\n updateMicronetModel response: ' + JSON.stringify ( response ) )
  let dbModelResponse = response.micronets.micronet.map ( ( micronet , index ) => {
    return {
      ...micronet ,
      "class" : micronet.name
    }
  } )
  console.log ( '\n dbModelResponse : ' + JSON.stringify ( dbModelResponse ) )
  return dbModelResponse
}

module.exports = {
  before : {
    all : [ // authenticate('jwt')
    ] ,
    find : [
      hook => {
        const { data , params , id } = hook;
        console.log ( '\n Before Find Hook ID : ' + JSON.stringify ( id ) + '\t\t DATA : ' + JSON.stringify ( data ) + '\t\t PARAMS : ' + JSON.stringify ( params ) )
      }
    ] ,
    get : [
      hook => {
        const { data , params , id } = hook;
        hook.params.mongoose = {
          runValidators : true ,
          setDefaultsOnInsert : true
        }
        const query = Object.assign ( { 'micronet-id' : id ? id.micronetId : params.micronetId } , hook.params.query );
        console.log ( '\n Before Get Hook ID : ' + JSON.stringify ( id ) + '\t\t DATA : ' + JSON.stringify ( data ) + '\t\t PARAMS : ' + JSON.stringify ( params ) )
        console.log ( '\n Before Get Hook QUERY : ' + JSON.stringify ( query ) )
        return hook.app.service ( '/mm/v1/micronets' ).find ( query )
          .then ( ( { data } ) => {
            console.log ( '\n DATA GET HOOK : ' + JSON.stringify ( data ) )
            hook.result = omitMeta ( data[ 0 ] );
            console.log ( '\n Hook Result : ' + JSON.stringify ( hook.result ) )
            Promise.resolve ( hook )
          } )
      }
    ] ,
    create : [
      async hook => {
        const { data , params , id } = hook;
        const { req } = hook.data.data
        const { body , originalUrl , method , path } = req
        console.log ( '\n INCOMING REQUEST BODY  : ' + JSON.stringify ( body ) )
        if ( originalUrl.toString () == '/mm/v1/micronets/init' ) {
          console.log ( '\n\n URL : ' + JSON.stringify ( originalUrl ) )
          const isGtwyAlive = await isGatewayAlive ( hook )
          const isOdlAlive = await isODLAlive ( hook )
          const isGatewayConnected = await connectToGateway ( hook )
          if ( isGtwyAlive && isGatewayConnected && isOdlAlive ) {
            console.log ( '\n isGatewayAlive : ' + JSON.stringify ( isGtwyAlive ) + '\t\t isGatewayConnected : ' + JSON.stringify ( isGatewayConnected ) + '\t\t isODLAlive : ' + JSON.stringify ( isOdlAlive ) )
            const postBody = await populatePostObj ( hook , body )
            console.log ( '\n CREATE HOOK OBTAINED POST BODY : ' + JSON.stringify ( postBody ) )
            const result = await initializeMicronets ( hook , postBody )
            console.log ( '\n CREATE MICRO-NET INIT HOOK RESULT : ' + JSON.stringify ( result ) )
            return Promise.resolve ( hook );
          }

        }

        if ( originalUrl.toString () == `/mm/v1/micronets/subnets` ) {
          console.log ( '\n CREATE' )
          const { data , id } = hook;
          const micronetFromDB = await getMicronet ( hook , {} )
          console.log ( '\n CREATE micronetFromDB : ' + JSON.stringify ( micronetFromDB ) )
          hook.id = micronetFromDB._id
          console.log ( '\n HOOK.ID PATCH METHOD : ' + JSON.stringify ( hook.id ) )
          const { body , originalUrl , method , path , params } = req
          console.log ( '\n CREATE HOOK BODY : ' + JSON.stringify ( body ) )
          console.log ( '\n CREATE HOOK ORIGINAL-URL : ' + JSON.stringify ( originalUrl ) )
          console.log ( '\n CREATE HOOK METHOD : ' + JSON.stringify ( method ) )
          console.log ( '\n CREATE HOOK path : ' + JSON.stringify ( path ) )
          console.log ( '\n CREATE HOOK params : ' + JSON.stringify ( params ) )
          hook.params.mongoose = {
            runValidators : true ,
            setDefaultsOnInsert : true
          }
          console.log ( '\n Update hook micronets to update database  id : ' + '\t\t ID : ' + JSON.stringify ( id ) )
          console.log ( '\n\n URL : ' + JSON.stringify ( originalUrl ) )
          const isGtwyAlive = await isGatewayAlive ( hook )
          const isOdlAlive = await isODLAlive ( hook )
          const isGatewayConnected = await connectToGateway ( hook )
          if ( isGtwyAlive && isGatewayConnected && isOdlAlive ) {
            console.log ( '\n isGatewayAlive : ' + JSON.stringify ( isGtwyAlive ) + '\t\t isGatewayConnected : ' + JSON.stringify ( isGatewayConnected ) + '\t\t isODLAlive : ' + JSON.stringify ( isOdlAlive ) )
            //const postBody = await populatePostObj(hook,body)
            //console.log('\n CREATE HOOK ADD SUBNET TO MICRO-NET OBTAINED POST BODY : ' + JSON.stringify(postBody))
            const postBodyForODL = await upsertSubnetsToMicronet ( hook , body )
            console.log ( '\n CREATE MICRO-NET ADD SUBNET TO MICRO-NET postBodyForODL : ' + JSON.stringify ( postBodyForODL ) )
            /* ODL API's */
            const odlConfigResponse = await upsertOdLConfigState ( hook , postBodyForODL )
            console.log ( '\n odlConfigResponse : ' + JSON.stringify ( odlConfigResponse ) )
            if ( odlConfigResponse ) {
              // const odlResponse = await fetchOdlOperationalState(hook,timer())
              const odlResponse = await fetchOdlOperationalState ( hook )
              if ( odlResponse ) {
                console.log ( '\n odlResponse : ' + JSON.stringify ( odlResponse ) )
                const dbUpdateResult = await updateMicronetModel ( hook , odlResponse )
                console.log ( '\n dbUpdateResult : ' + JSON.stringify ( dbUpdateResult ) )
                const patchResult = await hook.app.service ( '/mm/v1/micronets' ).patch ( hook.id ,
                   { micronets : { micronet : dbUpdateResult }}  ,
                  { query : {  }, mongoose: { upsert: true}});
                console.log('\n CREATE HOOK ADD SUBNET PATCH REQUEST RESULT : ' + JSON.stringify(patchResult))
                hook.result = patchResult
                return Promise.resolve(hook)
              }
            }
          }
        }
        if ( originalUrl.toString () == `/mm/v1/micronets/${req.params.micronetId}/subnets/${req.params.subnetId}/devices` ) {
          console.log ( '\n\n URL : ' + JSON.stringify ( originalUrl ) )
          const isGtwyAlive = await isGatewayAlive ( hook )
          const isOdlAlive = await isODLAlive ( hook )
          const isGatewayConnected = await connectToGateway ( hook )
          if ( isGtwyAlive && isGatewayConnected && isOdlAlive ) {
            console.log ( '\n isGatewayAlive : ' + JSON.stringify ( isGtwyAlive ) + '\t\t isGatewayConnected : ' + JSON.stringify ( isGatewayConnected ) + '\t\t isODLAlive : ' + JSON.stringify ( isOdlAlive ) )
            const postBody = await populatePostObj ( hook , body )
            console.log ( '\n CREATE HOOK ADD DEVICE TO SUBNET OBTAINED POST BODY : ' + JSON.stringify ( postBody ) )
            const result = await addDevicesToMicronet ( hook , postBody )
            console.log ( '\n CREATE MICRO-NET ADD DEVICE TO SUBNET HOOK RESULT : ' + JSON.stringify ( result ) )
            return Promise.resolve ( hook );
          }
        }
      }
    ] ,
    update : [] ,
    patch : [
      async (hook) => {
        const { data , id } = hook;
        console.log('\n PATCH HOOK data : ' + JSON.stringify(data) + '\t ID : ' + JSON.stringify(id))
        hook.data = data
        return Promise.resolve(hook)
      }
    ] ,
    remove : []
  } ,

  after : {
    all : [] ,
    find : [] ,
    get : [] ,
    create : [] ,
    update : [] ,
    patch : [] ,
    remove : []
  } ,

  error : {
    all : [] ,
    find : [] ,
    get : [] ,
    create : [] ,
    update : [] ,
    patch : [] ,
    remove : []
  }
};
