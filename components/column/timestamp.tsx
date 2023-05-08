// 'default' | 'defaultType' | 'nullable'

import { Box, MenuItem, Select, Switch, TextField } from "@mui/material";
import styles from 'styles/Schema.module.scss'
import { ColumnState } from ".";
import { useEffect, useState } from "react";

export default function TimestampConstructor(props: ColumnState) {
  const {
    default: defaultProp,
    defaultType: defaultTypeProp,
    nullable: nullableProp,
  } = props.column
  const [defaultValue, setDefaultValue] = defaultProp
  const [defaultType, setDefaultType] = defaultTypeProp
  const [nullable, setNullable] = nullableProp

  const [haveDefault, setHaveDefault] = useState(false) // if have default then disable nullable

  useEffect(() => {
    if (!props.isEdit) {
      setDefaultValue("")
      setDefaultType("value")
      setNullable("true")
    }
    if (defaultValue) {
      setHaveDefault(true)
    }
  }, [])

  useEffect(() => {
    if (haveDefault && !defaultValue) props.columnRule(false)
    else props.columnRule(true)
  }, [defaultValue, haveDefault])

  const changeDefault = () => {
    if (!haveDefault) {
      setNullable("false")
    }
    else {
      setDefaultType("value")
      setDefaultValue("")
    }
    setHaveDefault(!haveDefault)
  }

  const renderRules = () => {
    if (haveDefault) return (
      <Box display={"flex"} alignItems={"center"} marginY={"10px"} justifyContent={"flex-end"}>
        <Box display={"flex"} width={"80%"} justifyContent={"space-between"} alignItems={"center"}>
          <TextField value={defaultValue} variant="standard" type={'text'} onChange={e => setDefaultValue(e.target.value)} className={styles['input-label']} />
          <p>as</p>
          <Select
            variant="standard"
            value={defaultType}
            label="Column Type"
            onChange={e => { setDefaultType(e.target.value) }}
            sx={{width: "75px"}}
          >
            <MenuItem value={"value"}>Value</MenuItem>
            <MenuItem value={"expression"}>Expression</MenuItem>
          </Select>
        </Box>
      </Box>
    )
    return (
      <>
        <Box display={"flex"} alignItems={"center"} marginY={"10px"}>
          <TextField className={styles['input-label']} value={"Nullable"} variant="standard" type={'text'} InputProps={{ disableUnderline: true, readOnly: true }} />
          <p>:</p>
          <Switch checked={nullable} onClick={() => { setNullable(!nullable) }} />
        </Box>
      </>
    )
  }

  return (
    <>
      <Box display={"flex"} alignItems={"center"} marginY={"10px"}>
        <TextField className={styles['input-label']} value={"Default"} variant="standard" type={'text'} InputProps={{ disableUnderline: true, readOnly: true }} />
        <p>:</p>
        <Switch checked={haveDefault} onClick={changeDefault} />
      </Box>
      {renderRules()}
    </>
  )
}