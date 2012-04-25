#!/usr/bin/pythan

from optparse import OptionParser
import sys
import getpass

parser = OptionParser( description="Pastie is a secure internal paste bin.")

#parser.add_option("-p", dest="private",
    #action="store_true", help="create private pastie")
parser.add_option("-u", dest="user",
    action="store", help="list pasties created by USER")
parser.add_option("-s", dest="ID",
    action="store", help="print the pastie to stdout")
#parser.add_option("-x", dest="expression",
    #action="store", help="delete the pastie in the future. E.g. 10m, 1d, 2h")
parser.add_option("-d", dest="ID",
    action="store", help="delete the pastie")

(options, args) = parser.parse_args()


def read_config():
  handle = open("config.json")
  if not handle:
    return False
  return handle.read()

def save_pastie(options, config):
  payload = simplejson.dumps({
    description: options.get("description", False),
    private: options.get("private", False),
    content: sys.stdin.readlines(),
    author: getpass.getuser() or False,
    expiry: convert_expiry_to_seconds(options.get("expiry", False)),
  })
  jdata = json.dumps({"username":"...", "password":"..."})
  res = urllib2.urlopen(config["server"] + "/pastie", payload).read()
  return res

def convert_expiry_to_seconds(expiry_expr):
  if not expiry_expr return False
  scalar = {
    "s": 1,
    "m": 60,
    "h": 60*60,
    "d": 60*60*24,
    "w": 60*60*24*7,
    "m": 60*60*24*7*30,
    "y": 60*60*24*7*365,
  }[expiry_expr[-1]]
  num = int(expiry_expr[:-1])
  return False if not num else num*scalar

def main():
  config = read_config()
  if not config:
    print "You must include a config file."
  elif "user" in options:
    res = urllib2.urlopen(config.server + "/pastie/user/" + options.user).read()
    res = JSON.loads(res)
    for r in res["pasties"]
      print r["resource"], "    ", r["description"]
  elif "pastie_id" in options:
    res = urllib2.urlopen(config.server + "/pastie/id/" + options.pastie_id).read()
    res = JSON.loads(res)
    print res["pastie"]["content"]
  else:
    res = save_pastie(options, config)
    print res["pastie"]["resource"]
  print

if __name__ == "__main__":
  main()
