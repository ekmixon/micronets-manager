/* eslint-disable no-console */
const logger = require ( './logger' );
const app = require ( './app' );
const port = app.get ( 'port' );
const server = app.listen ( port );
const mano = app.get('mano')
const io = require ( 'socket.io' ) ( server );
const dw = require ( './hooks/dhcpWrapperPromise' )


process.on ( 'unhandledRejection' , ( reason , p ) =>
  logger.error ( 'Unhandled Rejection at: Promise ' , p , reason )
);

server.on ( 'listening' , async () => {
  logger.info ('Feathers application started on http://%s:%d', app.get('host'), port)
  let registry = await app.service ( '/mm/v1/micronets/registry' ).find ( {} )
  const registryIndex = registry.data.length > 0 ? registry.data.findIndex((registry) => registry.subscriberId == mano.subscriberId) : -1
  if ( registryIndex!= -1 ) {
    registry = registry.data[registryIndex]
    if( registry && registry.hasOwnProperty ( 'webSocketUrl' ) ) {
      logger.info ( '\n Web Socket Url from registry : ' + JSON.stringify ( registry.webSocketUrl ) )
      await dw.setAddress ( registry.webSocketUrl );
      await dw.connect ().then ( () => { return true } );
    }
  }

  // if ( mano && mano.hasOwnProperty('webSocketUrl') && !(registry && registry.hasOwnProperty ( 'webSocketUrl' ))) {
  //   logger.info('\n Connecting to : ' + JSON.stringify(mano.webSocketUrl) + ' from mano configuration ' )
  //   await dw.setAddress ( mano.webSocketUrl );
  //   await dw.connect ().then ( () => { return true } );
  // }

} );

io.on ( 'connection' , (() => logger.info ( 'Socket IO connection' )) )

app.service ( '/mm/v1/micronets/users' ).on ( 'userDeviceAdd' , ( data ) => {
  console.log ( '\n FeatherJS event userDeviceAdd fired with data : ' + JSON.stringify ( data ) )
  io.on ( 'connection' , ( socket ) => {
    logger.info ( 'Socket IO connection with data : ' + JSON.stringify ( data ) )
    socket.emit ( 'userDeviceAdd' , data );
    socket.on ( 'disconnect' , () => {
      console.log ( '\n Socket IO disconnect' + JSON.stringify ( socket.id ) + 'with Data : ' + JSON.stringify ( data ) )
      socket.removeAllListeners ( 'send message' );
      socket.removeAllListeners ( 'disconnect' );
      socket.removeAllListeners ( 'connection' );
      socket.disconnect ( true );
    } );
  } );
} );

async function upsertDeviceLeaseStatus ( message , type ) {
  logger.info ( '\n DeviceLease message : ' + JSON.stringify ( message ) + '\t\t Type : ' + JSON.stringify ( type ) )
  const isLeaseAcquired = type == 'leaseAcquiredEvent' ? true : false
  const eventDeviceId = isLeaseAcquired ? message.body.leaseAcquiredEvent.deviceId : message.body.leaseExpiredEvent.deviceId
  let user = await app.service ( '/mm/v1/micronets/users' ).find ( {} )
  user = user.data[ 0 ]
  const deviceIndex = user.devices.findIndex ( ( device ) => device.deviceId.toLocaleLowerCase () == eventDeviceId.toLocaleLowerCase () )
  const updatedDevice = Object.assign ( {} ,
    {
      ...user.devices[ deviceIndex ] ,
      deviceLeaseStatus : isLeaseAcquired ? 'positive' : 'intermediary'
    } )
  user.devices[ deviceIndex ] = updatedDevice
  const updateResult = await app.service ( '/mm/v1/micronets/users' ).update ( user._id , Object.assign ( {} , {
    id : user.id ,
    name : user.name ,
    ssid : user.ssid ,
    devices : user.devices
  } ) )
  return updateResult
}

dw.eventEmitter.on ( 'LeaseAcquired' , async ( message ) => {
  await upsertDeviceLeaseStatus ( message , 'leaseAcquiredEvent' )
} )

dw.eventEmitter.on ( 'LeaseExpired' , async ( message ) => {
  await upsertDeviceLeaseStatus ( message , 'leaseExpiredEvent' )
} )

app.service ( '/mm/v1/micronets/users' ).on ( 'userDeviceUpdate' , ( data ) => {
  logger.debug ( '\n FeatherJS event userDeviceUpdate fired with data : ' + JSON.stringify ( data ) )
  io.on ( 'connection' , ( socket ) => {
    logger.info ( 'Socket IO connection with data : ' + JSON.stringify ( data ) )
    socket.emit ( 'userDeviceUpdate' , data );
    socket.on ( 'disconnect' , () => {
      logger.debug ( '\n Socket IO disconnect' + JSON.stringify ( socket.id ) + 'with Data : ' + JSON.stringify ( data ) )
      socket.removeAllListeners ( 'send message' );
      socket.removeAllListeners ( 'disconnect' );
      socket.removeAllListeners ( 'connection' );
      socket.disconnect ( true );
    } );
  } );
} );

app.service ( '/mm/v1/subscriber' ).on ( 'micronetUpdated' , ( data ) => {
  logger.debug ( '\n FeatherJS event micronetUpdated fired with data : ' + JSON.stringify ( data ) )
  io.on ( 'connection' , ( socket ) => {
    logger.info ( 'Socket IO connection with data : ' + JSON.stringify ( data ) )
    socket.emit ( 'micronetUpdated' , data );
    socket.on ( 'disconnect' , () => {
      logger.debug ( '\n Socket IO disconnect' + JSON.stringify ( socket.id ) + 'with Data : ' + JSON.stringify ( data ) )
      socket.removeAllListeners ( 'send message' );
      socket.removeAllListeners ( 'disconnect' );
      socket.removeAllListeners ( 'connection' );
      socket.disconnect ( true );
    } );
  } );
} );

