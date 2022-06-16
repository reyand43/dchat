const User = require("./user");

class BinaryTree {
    constructor() {
        this.root = new User('empty', '0')
    }

    add(node) {
        if (!this.root) {
            this.root = node;
            return { parent: null };
        }

        const queue = [this.root];
        let itemAdded = false;

        while(queue.length && !itemAdded) {
            const tempNode = queue.shift();
            if (!tempNode.left) {
                tempNode.left = node;
                itemAdded = true
                return { parent: tempNode };
            } else {
                queue.push(tempNode.left)
            }
            if (!tempNode.right) {
                tempNode.right = node;
                itemAdded = true
                return { parent: tempNode };
            } else {
                queue.push(tempNode.right)
            }
        }
        return { parent: null };
    }

    getChidren(node) {
        const chidren = [];
        if (node.left) {
            chidren.push(node.left);
        }
        if (node.right) {
            chidren.push(node.right);
        }
        return chidren
    }

    addRoot(node) {
        if (!this.root) {
            this.root = node;
            return;
        }
        if (!this.getChidren(node).length) {
            node.left = this.root.left
            node.right = this.root.right
        }
        this.root = node;
    }

    search(searchedId, currentNode) {
        let foundNode = null;
        let foundNodeParent = null;
        function recursiveSearch(node, parent) {
            if (node != null) {
                if (node.socketId !== searchedId) {
                    if (node.left) {
                        recursiveSearch(node.left, node);
                    }
                    if (node.right) {
                        recursiveSearch(node.right, node);
                    }
                } else {
                    foundNode = node;
                    foundNodeParent = parent;
                    return
                }
            }
        }

        recursiveSearch(currentNode ? currentNode : this.root, null)
        return { node: foundNode, parent: foundNodeParent }
    }

    findDeepestLeaf(node) {
        let deepestLevel = 0;
        let deepestNode = 0;
        let deepestNodeParent = null;

        function find(node, level, parent) {
            if (!node.left && !node.right && deepestLevel < level) {
                deepestLevel = level;
                deepestNode = node;
                deepestNodeParent = parent
            }
            if (node.left) {
                find(node.left, level + 1, node)
            }
            if (node.right) {
                find(node.right, level + 1, node)
            }
        }
        find(node, 0, null)
        return { node: deepestNode, parent: deepestNodeParent }
    }

    remove(id) {
        if (!this.root) {
            return { chidren: [], parent: null, newNode: null};
        }

        // Если отключился стример что-то делаем
        if (this.root.socketId === id) {
            const { node: deletedNode } = this.search(id)
            const chidren = this.getChidren(deletedNode);
            const emptyRoot = new User('empty', '0');
            emptyRoot.left = deletedNode.left
            emptyRoot.right = deletedNode.right
            deletedNode.left = null;
            deletedNode.right = null;
            this.addRoot(emptyRoot);
            return { chidren, parent: null, newNode: null};
        }
        
        const { node: deletedNode, parent: deletedNodeParent } = this.search(id)

        if ( !deletedNode ) {
            return { };
        }

        // Если удаленный узел является листом то убираем ссылку на него у родителя
        if (!deletedNode.left && !deletedNode.right && deletedNodeParent) {
            if (deletedNodeParent?.left?.socketId === deletedNode.socketId) {
                deletedNodeParent.left = null;
            } else {
                deletedNodeParent.right = null;
            }
            return { chidren: this.getChidren(deletedNode), parent: deletedNodeParent.socketId !== '0' ? deletedNodeParent : null, newNode: null };
        }

        // Ищем лист из ветки удаленного узла
        const { node: leafNode, parent: leafNodeParent } = this.findDeepestLeaf(deletedNode)

        //Убираем у родителя листа ссылку на лист
        if (leafNodeParent.left?.socketId === leafNode.socketId) {
            leafNodeParent.left = null;
        } else {
            leafNodeParent.right = null;
        }

        // Если удаляемый узел не был корнем
        if (deletedNodeParent) {
            // Если удаляемый узел был левым
            if (deletedNodeParent.left?.socketId === deletedNode.socketId) {
                // Ставим лист на левое место родителя удаленного узла 
                deletedNodeParent.left = leafNode;
            } else {
                // Ставим лист на правое место родителя удаленного узла 
                deletedNodeParent.right = leafNode;
            }
        }

        // Устанавливаем детей удаленного узла листу
        leafNode.left = deletedNode.left
        leafNode.right = deletedNode.right
        return { chidren: this.getChidren(deletedNode), parent: deletedNodeParent.socketId !== '0' ? deletedNodeParent : null, newNode: leafNode, newNodeParent: leafNodeParent};
    }
}

module.exports = BinaryTree