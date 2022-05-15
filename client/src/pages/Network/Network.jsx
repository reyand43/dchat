/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import { useRef, useEffect, useState } from 'react';
import vis from 'vis';
import {
  select,
  json,
  tree,
  hierarchy,
  linkHorizontal,
  zoom,
} from 'd3';
import socket from '../../socket';
import ACTIONS from '../../socket/actions';
import './Network.css';

function Network() {
  const [treeStructure, setTree] = useState(null);
  const [formatedTree, setFormatedTree] = useState(null);

  useEffect(() => {
    socket.emit(ACTIONS.GET_GRAPH);
    socket.on(ACTIONS.USER_GRAPH_CHANGED, (newTree) => {
      console.log('INCOMING TREE', newTree);
      setTree(newTree);
    });
  }, []);

  const formatTree = (node) => {
    const children = [];
    console.log('NODE', node);
    if (node.left) {
      children.push(formatTree(node.left));
    }
    if (node.right) {
      children.push(formatTree(node.right));
    }
    const newFormatedTree = {
      name: node.name,
      children: [...children],
    };
    return newFormatedTree;
  };

  const drawTree = (treeData) => {
    const svg = select('svg');
    svg.selectAll('*').remove();
    const width = document.body.clientWidth;
    const height = document.body.clientHeight;

    const margin = {
      top: 0, right: 50, bottom: 0, left: 75,
    };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const treeLayout = tree().size([innerHeight, innerWidth]);

    const zoomG = svg
      .attr('width', width)
      .attr('height', height)
      .append('g');

    const g = zoomG.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    svg.call(zoom().on('zoom', (event) => {
      zoomG.attr('transform', event.transform);
    }));

    const root = hierarchy(treeData);
    console.log('ROOT', root);
    const links = treeLayout(root).links();
    const linkPathGenerator = linkHorizontal()
      .x((d) => d.y)
      .y((d) => d.x);

    g.selectAll('path').data(links)
      .enter().append('path')
      .attr('d', linkPathGenerator);

    g.selectAll('text').data(root.descendants())
      .enter().append('text')
      .attr('x', (d) => d.y)
      .attr('y', (d) => d.x)
      .attr('dy', '0.32em')
      .attr('text-anchor', (d) => (d.children ? 'middle' : 'start'))
      .attr('font-size', (d) => `${3.25}em`)
      .text((d) => d.data.name);
  };

  useEffect(() => {
    console.log('users', treeStructure);
    if (treeStructure) {
      setFormatedTree(formatTree(treeStructure));
    }
  }, [treeStructure]);

  useEffect(() => {
    if (formatedTree) {
      console.log('FORMATED TREE', formatedTree);
      drawTree(formatedTree);
    }
  }, [formatedTree]);

  return (
    <div id="wrapper">
      <svg id="svg" />
    </div>
  );
}

export default Network;
