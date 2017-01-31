var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("FundingHub error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("FundingHub error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("FundingHub contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of FundingHub: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to FundingHub.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: FundingHub not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "default": {
    "abi": [
      {
        "constant": false,
        "inputs": [],
        "name": "count",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "projects",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "project",
            "type": "uint256"
          },
          {
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "contribute",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "receiver",
            "type": "address"
          },
          {
            "name": "goal",
            "type": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256"
          },
          {
            "name": "project_name",
            "type": "string"
          }
        ],
        "name": "createProject",
        "outputs": [
          {
            "name": "proposal_id",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "inputs": [],
        "type": "constructor"
      }
    ],
    "unlinked_binary": "0x6060604052610bea806100126000396000f3606060405260e060020a600035046306661abd811461003f578063107046bd1461005a5780638c59091714610080578063c954e7ac14610106575b610002565b34610002576000545b60408051918252519081900360200190f35b346100025761025e600435600160205260009081526040902054600160a060020a031681565b61027a600435602435600082815260016020908152604080832054815183019390935280517fb60d42880000000000000000000000000000000000000000000000000000000081529051600160a060020a039093169263b60d42889234926004808201939182900301818588803b156100025761235a5a03f11561000257505050505050565b3461000257604080516020600460643581810135601f8101849004840285018401909552848452610048948235946024803595604435959460849492019190819084018382808284375094965050505050505060008484848460006000505460405161096e8061027c8339018086600160a060020a03168152602001858152602001848152602001806020018381526020018281038252848181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156101f05780820380516001836020036101000a031916815260200191505b509650505050505050604051809103906000f08015610002576000805481526001602081905260408220805473ffffffffffffffffffffffffffffffffffffffff19166c01000000000000000000000000948502949094049390931790925580549091019055949350505050565b60408051600160a060020a039092168252519081900360200190f35b00606060405260405161096e38038061096e83398101604052805160805160a05160c05160e051939492939192019060408051610100818101835287825260208083018881529383018781526000606085018181526080860182815260a0870189815260c0880184815260e089018c815285805260028089528a517fac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c89077b80546c0100000000000000000000000092830292909204600160a060020a03199092169190911781559b517fac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c89077c5596517fac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c89077d5593517fac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c89077e5591517fac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c89077f55517fac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c89078055517fac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c89078180547f01000000000000000000000000000000000000000000000000000000000000009283029290920460ff199092169190911790555180517fac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c89078280549381905296979695601f6001851615909102600019019093169390930482018490047fb140dba9958119c397cc767c336dfb67041b743be058b74d83311b8eb82bca4f90810194909291019083901061028757805160ff19168380011785555b506102709291505b808211156102b7576000815560010161025c565b5050505050505050506106b3806102bb6000396000f35b82800160010185558215610254579182015b82811115610254578251826000505591602001919060010190610299565b509056606060405236156100565760e060020a600035046330326c17811461005b578063590e1ae3146100b357806363bd1d4a146101f057806379c3422414610285578063978aceda1461030c578063b60d42881461031a575b610002565b3461000257600260208190526004803560009081526040902080546001820154938201546003830154938301546005840154600685015461037597600160a060020a0390951696949593949360ff9091169060070188565b346100025761043e604080516000808252915182917ff8c0b968fa409911e97ec381be5dff747f3efc4438a57904fc6922dce72e6b61919081900360200190a15b600154811015610466577ff8c0b968fa409911e97ec381be5dff747f3efc4438a57904fc6922dce72e6b616001600050828154811015610002576000918252602091829020015460408051600160a060020a039092168252519081900390910190a1600180548290811015610002576000918252602080832090910154828052600290915260018054600160a060020a03909216926108fc9260008051602061069383398151915292908690811015610002576000918252602080832090910154600160a060020a0316835282019290925260409081018220549051811593909302929091818181858888f1935050505015156104a357610002565b34610002576104525b600080805260026020527fac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c890781805460ff191660011790557fac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c89077b54604051600160a060020a0391821692839230163180156108fc02929091818181858888f1935050505015156104ab57610002565b3461000257610454600160008181526000805160206106938339815191526020527f53fafb85532a1e8c4029918d6bb36f6bf370ed3be9ff014e8f69e9188adf045a8054600901905581548083018084559192918281838015829011610583576000838152602090206105839181019083015b8082111561049f57600081556001016102f8565b346100025761045460005481565b61043e600160a060020a0332166000908152600080516020610693833981519152602052604081208054340190556001805480820180835582818380158290116105f4576000838152602090206105f49181019083016102f8565b60408051600160a060020a038a16815260208101899052908101879052606081018690526080810185905260a0810184905282151560c082015261010060e082018181528354600260001960018316158502019091160491830182905290610120830190849080156104285780601f106103fd57610100808354040283529160200191610428565b820191906000526020600020905b81548152906001019060200180831161040b57829003601f168201915b5050995050505050505050505060405180910390f35b604080519115158252519081900360200190f35b005b60408051918252519081900360200190f35b604080516001815290517ff8c0b968fa409911e97ec381be5dff747f3efc4438a57904fc6922dce72e6b619181900360200190a1600191505b5090565b6001016100f4565b6000805260026020818152604080518281527fac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c89078280546000196101006001831615020116949094049281018390527f60d53f07f7e698e57c813f762e396594f2f75f905fdec13300a8b292352e23a393929091829190820190849080156105725780601f1061054757610100808354040283529160200191610572565b820191906000526020600020905b81548152906001019060200180831161055557829003601f168201915b50509250505060405180910390a150565b5050506000928352506020808320909101805473ffffffffffffffffffffffffffffffffffffffff19166001908117909155600983559091526000805160206106938339815191529052507f53fafb85532a1e8c4029918d6bb36f6bf370ed3be9ff014e8f69e9188adf045a545b90565b5050506000928352506020808320909101805473ffffffffffffffffffffffffffffffffffffffff19166c0100000000000000000000000032810204179055908052600290527fac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c89077f80543401908190557fac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c89077c5490106105f1576105f16101f956ac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c890783",
    "events": {},
    "updated_at": 1485477516943,
    "links": {},
    "address": "0x4ef6e8219c042ca9b9533d65c4cfc8c1ef9ade0d"
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "FundingHub";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.FundingHub = Contract;
  }
})();
