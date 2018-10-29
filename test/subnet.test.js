var assert = require('assert')
var chai = require('chai')
var should = chai.should()
var subnet
var newSubnet = {}
var app = require('../api/app')
const port = app.get('port');
var server

describe('Test Subnet Allocation', function() {
  before(function(done) {
    app.get('subnet')
      .then((subnetObj) => {
        subnet = subnetObj
        subnet.db.removeMany({}, function(err, res) {
          if (err) {
            console.log(err);
            done(err)
          }
          else {
            done()
          }
        })
      })
      .catch(err => {
        done(err)
      })
  })
  it('Verify Config', (done) =>{
    subnet.OCTET_A.should.equal(192)
    subnet.OCTET_B.should.equal(168)
    subnet.SUBNET_MIN.should.equal(10)
    subnet.SUBNET_MAX.should.equal(254)
    subnet.IP_MIN.should.equal(2)
    subnet.IP_MAX.should.equal(254)
    done()
  })
  it('Get Subnet Object', (done) => {
    subnet.getNewSubnet(0)
      .then((sn) => {
        newSubnet = sn
        newSubnet.subnet.should.equal(10)
        newSubnet.micronetSubnet.should.equal('192.168.10.0/24')
        newSubnet.mask.should.equal('255.255.255.0')
        newSubnet.micronetGatewayIp.should.equal('192.168.10.1')
        newSubnet.vlan.should.equal(0)
      }).then(done, done)
  })
  it('Get Array of Subnet Objects', (done) => {
    let promiseList = []
    for (let i = 0;i < 10; i ++) {
      promiseList.push(subnet.getNewSubnet(0))
    }
    Promise.all(promiseList)
      .then((snArray) => {
        snArray.length.should.equal(10)
        for (let subnet = 0; subnet < 10; subnet++) {
          snArray[subnet].subnet.should.equal(12 + (2*subnet))
        }
      }).then(done, done)
  })
  it('Get Two Host Objects', (done) => {
    let devices = [
      {
        deviceMac: "b8:27:eb:df:ae:a7",
        deviceName: "pib",
        deviceId: "Raspberry-Pi3-Model-B-v1.2"
      },
      {
        deviceMac: "b8:27:eb:df:ae:a8",
        deviceName: "pib2",
        deviceId: "Raspberry-Pi3-Model-B-v1.2"
      },
    ]
    subnet.getNewIps(newSubnet.subnet, devices)
      .then((sn) => {
        newSubnet = sn;
        newSubnet.subnet.should.equal(10)
        newSubnet.micronetSubnet.should.equal('192.168.10.0/24')
        newSubnet.mask.should.equal('255.255.255.0')
        newSubnet.micronetGatewayIp.should.equal('192.168.10.1')
        newSubnet.vlan.should.equal(0)
        newSubnet.connectedDevices.length.should.equal(2)
        newSubnet.connectedDevices[0].deviceMac.should.equal(devices[0].deviceMac)
        newSubnet.connectedDevices[0].deviceId.should.equal(devices[0].deviceId)
        newSubnet.connectedDevices[0].deviceIp.should.equal('192.168.10.2')
        newSubnet.connectedDevices[0].host.should.equal(2)

        newSubnet.connectedDevices[1].deviceMac.should.equal(devices[1].deviceMac)
        newSubnet.connectedDevices[1].deviceId.should.equal(devices[1].deviceId)
        newSubnet.connectedDevices[1].deviceIp.should.equal('192.168.10.3')
        newSubnet.connectedDevices[1].host.should.equal(3)
      }).then(done, done)
  })
  it('Get 2nd Subnet Object', (done) => {
    subnet.getNewSubnet(0)
      .then((sn) => {
        newSubnet = sn
        newSubnet.subnet.should.equal(32)
        newSubnet.micronetSubnet.should.equal('192.168.32.0/24')
        newSubnet.mask.should.equal('255.255.255.0')
        newSubnet.micronetGatewayIp.should.equal('192.168.32.1')
        newSubnet.vlan.should.equal(0)
      }).then(done, done)
  })
  it('Get Two Host Objects', (done) => {
    let devices = [
      {
        deviceMac: "b8:27:eb:df:ae:a9",
        deviceName: "pib3",
        deviceId: "Raspberry-Pi3-Model-B-v1.2"
      },
      {
        deviceMac: "b8:27:eb:df:ae:aa",
        deviceName: "pib4",
        deviceId: "Raspberry-Pi3-Model-B-v1.2"
      },
    ]
    subnet.getNewIps(newSubnet.subnet, devices)
      .then((sn) => {
        newSubnet = sn;
        newSubnet.subnet.should.equal(32)
        newSubnet.micronetSubnet.should.equal('192.168.32.0/24')
        newSubnet.mask.should.equal('255.255.255.0')
        newSubnet.micronetGatewayIp.should.equal('192.168.32.1')
        newSubnet.vlan.should.equal(0)
        newSubnet.connectedDevices.length.should.equal(2)
        newSubnet.connectedDevices[0].deviceMac.should.equal(devices[0].deviceMac)
        newSubnet.connectedDevices[0].deviceId.should.equal(devices[0].deviceId)
        newSubnet.connectedDevices[0].deviceIp.should.equal('192.168.32.2')
        newSubnet.connectedDevices[0].host.should.equal(2)

        newSubnet.connectedDevices[1].deviceMac.should.equal(devices[1].deviceMac)
        newSubnet.connectedDevices[1].deviceId.should.equal(devices[1].deviceId)
        newSubnet.connectedDevices[1].deviceIp.should.equal('192.168.32.3')
        newSubnet.connectedDevices[1].host.should.equal(3)
      }).then(done, done)
  })
  it('Fail To Create Host IP MAX', (done) => {
    subnet.IP_MAX = 3;
    let devices = [
      {
        deviceMac: "b8:27:eb:df:ae:ab",
        deviceName: "pib5",
        deviceId: "Raspberry-Pi3-Model-B-v1.2"
      }
    ]
    subnet.getNewIps(newSubnet.subnet, devices)
      .then((sn) => {
       done(new Error("Should not create ip address 4"))
      })
      .catch((err) =>{
        done();
      })
  })
  it('Get a Specific Subnet', (done) => {
    subnet.getNewSubnet(0, 100)
      .then((sn) => {
        newSubnet = sn
        newSubnet.subnet.should.equal(100)
        newSubnet.micronetSubnet.should.equal('192.168.100.0/24')
        newSubnet.mask.should.equal('255.255.255.0')
        newSubnet.micronetGatewayIp.should.equal('192.168.100.1')
        newSubnet.vlan.should.equal(0)
      }).then(done, done)
  })
  it('Get an Allocated Subnet', (done) => {
    subnet.getNewSubnet(0, 100)
      .then(() => {
        fail()
      })
      .catch(err => {
        done()
      })
  })
  it('Remove a Allocated Subnet', (done) => {
    subnet.deallocateSubnet(0, 100)
      .then(() => {

      }).then(done, done)
  })
  it('Get Array of Specific Subnet Objects', (done) => {
    let promiseList = []
    for (let i = 0;i < 10; i ++) {
      promiseList.push(subnet.getNewSubnet(0, 34+i))
    }
    Promise.all(promiseList)
      .then((snArray) => {
        snArray.length.should.equal(10)
        for (let subnet = 0; subnet < 10; subnet++) {
          snArray[subnet].subnet.should.equal(34 + subnet)
        }
      }).then(done, done)
  })
  it('Remove a Bunch of Allocated Subnet', (done) => {
    let promiseList = []
    for (let i = 0;i < 10; i ++) {
      promiseList.push(subnet.deallocateSubnet(0, 34+i))
    }
    Promise.all(promiseList)
      .then(() => {
      }).then(done, done)
  })
  it('Get Removed Subnet Objects', (done) => {
    let devices = [
      {
        deviceMac: "b8:27:eb:df:ae:a7",
        deviceName: "pib",
        deviceId: "Raspberry-Pi3-Model-B-v1.2"
      },
      {
        deviceMac: "b8:27:eb:df:ae:a8",
        deviceName: "pib2",
        deviceId: "Raspberry-Pi3-Model-B-v1.2"
      },
    ]
    subnet.getNewIps(34, devices)
      .then((sn) => {
        done(new('Should not have IPs on removed subnet'))
      })
      .catch(()=> {
        done()
      })
  })
  it('Ashiwinis Problem', (done) => {

    let devices = [{deviceMac: 'b8:27:eb:8d:30:27', deviceName: 'pia', deviceId: 'Raspberry-Pi3-Model-B-v1.2'}]
    subnet.getNewSubnet(0, 251)
      .then(mysubnet => {
        subnet.getNewIps(250, devices)
          .then((sn) => {
            fail('Should not create IPs for non-existant subnet')
          })
          .catch(err => {
            done()
          })
      })

  })
})